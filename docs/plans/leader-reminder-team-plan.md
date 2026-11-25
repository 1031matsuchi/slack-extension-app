# リーダー（共通基盤・リマインダー・外部連携）開発進め方プラン

- **担当領域**: `app.js`, `lib/`, `routes/cron.js`, `prisma/`, `apps/calendar-reminder-bot/`, 外部アプリ連携通知（`external-notify-service.js`）、PR レビュー・マージ、本番インフラ運用
- **参照すべき設計書**: [`docs/specs/BASIC_DESIGN.md`](../specs/BASIC_DESIGN.md) / [`docs/specs/DETAIL_DESIGN.md`](../specs/DETAIL_DESIGN.md)

---

## 1. リーダーの 2 つのミッション

1. **チーム開発のイネーブラー（ブロッカー解消）**:
   - GAS 班・Bot 班が迷わず並行開発できるよう、開発用無料枠 API キー・テスト用環境案内・DB マイグレーションを一元管理し、小さな PR を素早くレビュー・マージする。
2. **`calendar-reminder-bot` ＆ 外部アプリ連携基盤の実装と本番デプロイ**:
   - 予定リマインド機能と、他学生が開発する外部アプリからの Pull 型通知相乗り機能を実装し、Render / TiDB Cloud / `cron-job.org` へ本番リリースする。

---

## 2. ステップ別 進め方

### Step 0：キックオフ ＆ 共通基盤の調整（Day 1）
- [ ] **開発用リソースの共有**:
  - 請求先未設定の開発用 GCP プロジェクト（強制無料枠）の Gemini API キー、およびサービスアカウント情報を安全な経路でチームへ共有する（**実データ入力厳禁**を口頭・チャットでも徹底周知）。
  - テスト用 Google カレンダーと `docs/wiki-local-slack-app-setup-guide.md`（GitHub Wiki）をメンバーへ案内する。
- [ ] **TBD の合意と DB マイグレーション先行対応**:
  - Bot 班と「複数カレンダーの DB 物理設計（新規テーブル `workspace_calendars` vs 既存テーブル拡張）」および「重複登録防止用テーブル／カラム」を確定する。
  - `prisma/schema.prisma` を更新し、`npx prisma migrate dev --name <name> --config prisma7.config.ts` でマイグレーション SQL を作成して `main` へマージする（全メンバーが `git pull` + `migrate deploy` できる状態を早期に作る）。
- [ ] **既存雛形・環境整理の判断**:
  - 各 Bot 内の `listeners/messages/sample-message.js` の存廃、および Windows 改行コード対策（`.gitattributes` で LF 固定するか）を決定する。

### Step 1：`calendar-reminder-bot` の詳細要件確定・実装（Day 1〜4）
現在最小骨組みとなっている [`apps/calendar-reminder-bot/services/reminder-service.js`](../../apps/calendar-reminder-bot/services/reminder-service.js) について、以下の TBD を確定し実装します。

- [ ] **仕様確定**:
  - 配信タイミング・頻度（例：毎朝 8:00 JST 等）
  - 取得対象期間（当日のみ／翌日含む等）
  - 予定 0 件時の挙動（通知をスキップするか「予定なし」と投稿するか）
  - 通知メッセージフォーマット、および App Home の「📅 今日の予定を今すぐ確認」ボタンの存廃
- [ ] **実装＆テスト**:
  - `reminder-service.js` に `lib/google-calendar.js`（`getUpcomingEvents`）と Slack 投稿（`postMessage`）を接続（ワークスペース単位の `try...catch` による Fault Isolation を維持）。
  - `tests/calendar-reminder-bot/reminder-service.spec.js` および `tests/routes/cron.spec.js` を更新し、`npm test` 全件 PASS を確認。

### Step 2：外部アプリ連携通知（Pull 型）の仕様確定・実装（Day 5〜7）
[`docs/specs/BASIC_DESIGN.md`](../specs/BASIC_DESIGN.md) 第 5 章の叩き台をベースに、連携予定の他学生アプリ開発者とも合意のうえ実装します。

- [ ] **共通 API 契約の確定**:
  - 環境変数ホワイトリスト（`EXTERNAL_NOTIFY_SOURCES`）の最終形式
  - 外部アプリ `GET` レスポンスの JSON スキーマ（`id`, `title`, `body`, `url`, `publishedAt`、1回あたり最大件数、認証ヘッダー要否）
- [ ] **DB マイグレーション追加**:
  - 通知済み識別子を記録するテーブル（例：`ExternalNotificationHistory`、`id` 主キー・`createdAt`/`updatedAt`・`@@unique([sourceId, workspaceId, externalEventId])`・日本語コメント付き）を `prisma/schema.prisma` へ追加し、`migrate dev` を実行。
- [ ] **サービス実装＆接続**:
  - `apps/calendar-reminder-bot/services/external-notify-service.js` を新規作成（1 API あたり **5 秒タイムアウト**、`AbortController`、エラー時スキップ＆他 API 継続、DB による重複排除）。
  - `routes/cron.js` の `POST /cron/remind` から、カレンダーリマインドと外部アプリ巡回の両方を独立した `try...catch` で呼び出す（一方が失敗しても他方を止めない）。
  - 正常系・タイムアウト・重複スキップ・不正 JSON 時の単体テストを追加。

### Step 3：本番リリース・運用立ち上げ（結合完了後）
1. **有料枠（Paid Tier）API キーへの切り替え**:
   - 本番用 GCP プロジェクト（Paid Tier・データ学習 OFF）で Gemini API キーを発行し、**月額 500 円の予算アラート** を設定する。
2. **本番インフラ構築**（詳細は GitHub Wiki の OAuth 本番設定ガイド参照）:
   - **TiDB Cloud Serverless**: 本番 DB 作成 ➔ `npx prisma migrate deploy --config prisma7.config.ts` でマイグレーション適用。
   - **本番用 Slack App（2種）**: `message-calendar-bot` / `calendar-reminder-bot` を作成し、Redirect URL・Event Subscriptions・Interactivity Request URL（`/slack/<appName>/events`）を設定して Public Distribution を有効化。
   - **Render Web Service（Free 1インスタンス）**: 環境変数設定・デプロイ・`/health` 確認。
   - **cron-job.org**: スリープ防止（`GET /health` 10〜14分間隔）および定期配信（`POST /cron/remind` + `Authorization: Bearer <CRON_SECRET>`）を設定。
   - **GAS Web アプリ**: チーム共通アカウント（`akitacore.stamina@gmail.com`）で「自分として実行」デプロイし、スクリプトプロパティへ本番有料枠 API キーとパスコードを設定。

---

## 3. PR レビュー時の確認観点（`code-review-and-qa` 準拠）

メンバーから PR が上がったら、以下を確認してマージします（詳細：[`.agents/skills/code-review-and-qa/SKILL.md`](../../.agents/skills/code-review-and-qa/SKILL.md)）：

- [ ] 担当ファイル境界が守られ、他 Bot のコードへ直接依存していないか。
- [ ] `try...catch`・`await ack()`・環境変数未設定時の `null` 返却（Fault Isolation）が守られているか。
- [ ] `workspaceId` 命名統一・ケバブケース・初学者向けコメント・秘密情報未混入を満たしているか。
- [ ] 変更ファイルに Biome エラーがなく、`npm test` が全件 PASS しているか。
