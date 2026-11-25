# Bot 班（メンバー C・D）開発進め方プラン

- **対象サブシステム**: Slack 予定登録 Bot（`apps/message-calendar-bot/`）
- **参照すべき要件定義書**: [`docs/specs/message-calendar-bot-requirements.md`](../specs/message-calendar-bot-requirements.md)
- **採用モデル・UI 方針**: `gemini-3.5-flash-lite`（日常開発は `MOCK_GEMINI=true`）、GUI ファースト（スラッシュコマンド禁止）、DB 管理の複数カレンダー選択・`✅` 付与・重複登録防止・Slack 上での予定削除（MVP）

---

## 1. メンバー別 担当ファイル分担（コンフリクト防止）

リスナー（Slack とのやり取り）とサービス（AI・カレンダー・DB ロジック）を明確に分離します。

| 担当 | 担当ディレクトリ | 担当領域 |
| :--- | :--- | :--- |
| **メンバー C** | `apps/message-calendar-bot/listeners/`<br>`apps/message-calendar-bot/manifest.json`<br>`tests/message-calendar-bot/`（リスナーテスト） | `📅`/`📆` リアクション検知（`reaction-added.js`）、登録先カレンダー選択ボタン UI・アクション（`actions/`）、`✅` スタンプ付与、予定削除ボタン UI、スレッド返信 |
| **メンバー D** | `apps/message-calendar-bot/services/`<br>`tests/message-calendar-bot/`（サービステスト） | `lib/gemini.js` 呼び出し（プロンプト・JSON スキーマ設計）、`lib/google-calendar.js` 連携、同一メッセージ重複登録チェック、登録者本人 / Primary Owner の削除権限チェック |

---

## 2. ステップ別 進め方

### Step 0：ローカル環境準備 ＆ 未確定事項（TBD）の確定（Day 1）
1. **ローカル環境のセットアップ**（詳細は [`README.md`](../../README.md) 第 4 章参照）:
   - `npm install`、XAMPP MySQL 起動、`npx prisma migrate deploy --config prisma7.config.ts`
   - 自分専用の個人テスト用 Slack App（Socket Mode）を作成し、`.env` に `MESSAGE_CALENDAR_BOT_BOT_TOKEN` / `MESSAGE_CALENDAR_BOT_APP_TOKEN` を設定（※ OAuth 用 `*_CLIENT_ID` 等は `YOUR_...` のままにする）。
   - `.env` に **`MOCK_GEMINI=true`** を設定し、`npm run dev` で起動することを確認する。
2. **メンバー C・D ＋ リーダーで TBD を確定** し、[`docs/specs/message-calendar-bot-requirements.md`](../specs/message-calendar-bot-requirements.md) へ追記する：
   - [ ] 複数カレンダーの DB 物理設計（新規テーブル作成 vs 既存テーブル拡張 → **Prisma スキーマ変更とマイグレーション作成はリーダーと連携**）
   - [ ] Gemini へ渡すプロンプトと抽出 JSON スキーマ（タイトル・開始/終了日時・終日・場所・説明など）
   - [ ] カレンダー選択ボタン・完了通知・削除確認のメッセージ文面
   - [ ] 同一メッセージ重複判定キー（`channelId` + `messageTs` 等）と削除後の再登録仕様

### Step 1：完全モックによる MVP 一気通貫疎通（Day 1〜4）
`.env` を **`MOCK_GEMINI=true`** にしたまま、外部 AI 通信なしで以下の全フローをテスト用 Slack ワークスペースで通します。

1. **メンバー D（`services/`）**:
   - `lib/gemini.js` の `extractEventFromMessage()` を使ってモック JSON を受け取り、カレンダー登録用データへ整形するサービスを作成。
   - 重複チェック・Google カレンダー登録（`lib/google-calendar.js`）・削除権限判定（登録者本人または Primary Owner）の関数を実装し、モックを使った単体テストを作成。
2. **メンバー C（`listeners/`）**:
   - `reaction-added.js` で `📅`/`📆` リアクションを検知 → メッセージ取得 → メンバー D のサービス呼び出し → カレンダー選択ボタンをスレッド投稿。
   - ボタン押下アクション（`actions/`）で `await ack()` → 登録実行 → 元メッセージへ `✅` リアクション付与 → 削除ボタン付き完了返信。
   - 削除ボタン押下アクションで `await ack()` → 権限チェック → カレンダーから削除 → 完了通知。
3. **Day 4 ゴール**: `MOCK_GEMINI=true` の状態で、Slack メッセージに 📅 を押してから「カレンダー選択 → テストカレンダー登録 → `✅` 付与 → 削除ボタンで削除」までが一通り動くこと。

### Step 2：開発用無料枠キー ＆ 架空データでのプロンプト検証（Day 5〜7）
1. `.env` を `MOCK_GEMINI=false` に変更し、開発用無料枠の `GEMINI_API_KEY` と `GEMINI_MODEL=gemini-3.5-flash-lite` を設定する。
2. **完全な架空のイベント告知メッセージ**（例：「来週金曜 15時から架空テスト会議を行います」）をテスト用 Slack チャンネルへ投稿し、日時抽出・終日判定・曖昧表現の補完精度を検証・チューニングする。

> [!CAUTION]
> **無料枠 API キーでの検証時は、本物の学内連絡メッセージや生徒・教員の実名を含む投稿を絶対に入力しないでください。**

---

## 3. 実装・PR 提出時の必須チェックリスト（`add-slack-listener` 準拠）

PR を出す前に、以下を必ず確認してください（詳細：[`.agents/skills/add-slack-listener/SKILL.md`](../../.agents/skills/add-slack-listener/SKILL.md)）：

- [ ] **ファイル命名**: すべてケバブケース（例：`select-calendar.js`）。
- [ ] **入口での `workspaceId` 変換**: Slack の `context?.teamId` / `body?.team?.id` をリスナー入口で `workspaceId` として受け取り、サービス層には `workspaceId` のみ渡しているか。
- [ ] **例外隔離と 3 秒ルール**: すべてのリスナーが `try...catch` + `logger.error(error)` で囲まれ、`actions` / `views` の冒頭で `await ack()` を呼んでいるか。
- [ ] **初学者向けコメント**: 処理の意図や JSDoc コメントを記載しているか。
- [ ] **Manifest 同期**: 追加したスコープ・イベント（例：`reactions:write` 等）を `apps/message-calendar-bot/manifest.json` および `apps/message-calendar-bot/index.js` の `SCOPES` に反映しているか。
- [ ] **単体テスト**: 正常系・異常系（例外時に `logger.error` が呼ばれること）の両方を `tests/message-calendar-bot/` に追加したか。
- [ ] **完了ゲート**: 変更ファイルの Biome チェックがエラー 0 件、かつ `npm test` が全件 PASS すること。
- [ ] **バディチェック**: ペアの相手（C ↔ D）の確認後にリーダーへ PR レビューを依頼したか。
