# プロジェクト概要・現状サマリー（Project Overview）

> **対象読者**: 開発チームメンバーおよび本リポジトリ上で作業するコーディングエージェント  
> **作成方針**: これまでの意思決定・リポジトリの実コード・設計ドキュメントの事実のみを記載し、憶測は含めません。未確定事項は「7. 未確定事項・今後の課題」に明記します。

---

## 1. プロジェクトの背景と目的

学校内の行事予定やイベント情報が複数媒体に分散している課題を解決するため、**Google カレンダーを単一のデータハブ（Single Source of Truth）** とし、年間予定の取り込み・Slack からの予定登録・定時リマインドおよび他学生開発アプリの通知を Slack へ集約するシステムを開発しています。

### 対象サブシステム（3サブシステム構成・モノレポ同居）
1. **年間行事予定インポーター（GAS Web アプリ）**: `gas/excel-calendar-importer/`（※タスク3で雛形配置予定）。チーム共通 Gmail（`akitacore.stamina@gmail.com`）で「自分として実行」デプロイ＋簡易パスコード認証を行い、年間予定 Excel から複数の校内共有 Google カレンダーへ一括登録する。
2. **Slack 予定登録 Bot**: `apps/message-calendar-bot/`。Slack 投稿への `📅`/`📆` リアクションを起点に AI で予定を抽出し、DB 管理された共有カレンダーの選択ボタン経由で登録・`✅` 付与・重複防止・Slack 上での予定削除を行う（MVP）。
3. **予定リマインド ＋ 外部アプリ連携通知 Bot**: `apps/calendar-reminder-bot/`。`cron-job.org` からの定期実行をトリガーに、Google カレンダーの予定リマインドおよび他学生開発の外部アプリ API からの Pull 型通知を同一チャンネルへ配信する。

---

## 2. 合意済みのアーキテクチャ・技術方針

| 領域 | 確定方針 | 根拠・詳細 |
| :--- | :--- | :--- |
| **ホスティング構成** | **単一プロセス・マルチ Bot 相乗り**（Render Free 1インスタンス） ＋ **GAS モノレポ同居** | Render 無料枠（月 750 時間）を 2 つの Slack Bot で共有し、GAS Web アプリも同じリポジトリ（`gas/`）で一元管理する |
| **Slack 配布・認証** | **本格配布レベル1（OAuth 2.0 Direct Install）**<br>※ ローカル開発時は **Socket Mode** も両対応 | `lib/slack-app-factory.js` により自動切替。未設定・`YOUR_*` 時は `null` で安全にスキップする |
| **Google カレンダー連携** | **案A：サービスアカウント共有方式** | チーム共通アカウント（`akitacore.stamina@gmail.com`）のサービスアカウントを各校内共有カレンダーへ共有追加して連携する |
| **Gemini API 運用** | **Gemini 3系ハイブリッド**（GAS: `gemini-3.8-flash` / Bot: `gemini-3.5-flash-lite`） | 本番は有料枠（学習 OFF・予算アラート月額 500 円）。開発時は `MOCK_GEMINI=true` ＋ 請求先未設定の開発用無料枠（**実データ入力厳禁**）を併用する |
| **UI / UX** | **GUI 一本化（案1 + 案2 併用）** | スラッシュコマンドを廃止し、App Home ダッシュボード・モーダル・チャンネル選択プルダウン・インストール直後 DM に統一 |
| **DB 変更管理** | **Prisma Migrate（`prisma/migrations/`）** | `db push` 禁止。全テーブル `id` 主キー、`createdAt`/`updatedAt`、`workspaceId` 統一、日本語コメント必須 |

---

## 3. 技術スタック（`package.json` 基準）

- **Node.js / ES Modules**（`"type": "module"`）、`@slack/bolt` `^5.1.0`
- **Prisma 7**（`@prisma/client`, `@prisma/adapter-mariadb` `^7.10.1`, `mariadb` `^3.5.4`, `prisma7.config.ts`）＋ MySQL 互換（ローカル: XAMPP / 本番: TiDB Cloud）
- **AI / Google API**: `@google/genai` `^3.3.0`, `googleapis` `^190.0.0`
- **静的解析 / テスト**: `@biomejs/biome` `^2.5.14`, `node:test` / `node:assert`

---

## 4. リポジトリの現状

- **基盤・共通モジュール**: `app.js`, `apps/index.js`, `routes/cron.js`, `lib/`（`prisma.js`, `slack-installation-store.js`, `slack-app-factory.js`, `slack-setup-ui.js`, `google-calendar.js`）, `prisma/schema.prisma`（`SlackInstallation`, `WorkspaceCalendarConfig`）は実装・テスト済み。
- **最小骨組み（詳細仕様確定待ち）**: `lib/gemini.js`, `apps/message-calendar-bot/listeners/events/reaction-added.js`, `apps/calendar-reminder-bot/services/reminder-service.js` は共通インターフェイスとエラー隔離の最小骨組み状態。
- **ドキュメント体系**: `README.md`、`AGENTS.md`、および `docs/specs/`（`REQUIREMENTS.md`, `gas-importer-requirements.md`, `message-calendar-bot-requirements.md`, `BASIC_DESIGN.md`, `DETAIL_DESIGN.md`, `diagrams/architecture.drawio`）へ最新化・統合済み。
- **テスト状況**: `npm test` にて 13 スイート・55 テスト PASS。

---

## 5. チーム体制（5名体制）

- **リーダー（1名）**: 共通基盤（`app.js`, `lib/`, `routes/`, `prisma/`）、`apps/calendar-reminder-bot/`、PR レビュー・マージ
- **GAS 班（2名）**: メンバー A（`gas/excel-calendar-importer/index.html`）／メンバー B（`gas/excel-calendar-importer/code.gs`）
- **Bot 班（2名）**: メンバー C（`apps/message-calendar-bot/listeners/`）／メンバー D（`apps/message-calendar-bot/services/`）

---

## 6. 未確定事項・今後の課題（TBD：憶測で実装しないこと）

1. `calendar-reminder-bot` の詳細仕様（配信タイミング・頻度、対象期間、予定 0 件時の挙動、通知フォーマット、App Home「今日の予定を今すぐ確認」ボタンの存廃）。
2. 外部アプリ連携 API の最終 JSON スキーマ・配列上限・認証ヘッダー要否（`BASIC_DESIGN.md` 第5章の叩き台をレビュー中）。
3. 複数カレンダーの DB 物理設計（新規テーブル作成 vs 既存テーブルへの JSON カラム追加）。
4. GAS Web アプリの詳細仕様（対象 Excel の実レイアウト、登録前プレビュー・手動修正画面の有無、エラー時フィードバック）。
5. Gemini プロンプト・Structured Outputs スキーマ詳細。
6. 既存雛形 `listeners/messages/sample-message.js` の存廃、および Windows の改行コード（`.gitattributes` による LF 固定）方針。
7. 次期フェーズ検討課題：行事キーワード類似予定検知・削除依頼ワークフロー（旧 `REQ-08`）、および個人マイカレンダー連携。
