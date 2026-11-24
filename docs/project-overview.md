# プロジェクト概要・現状サマリー（Project Overview）

> **対象読者**: 開発チームメンバーおよび本リポジトリ上で作業するコーディングエージェント  
> **基準時点**: 2026-11-19 / ブランチ `delete/test_app`（最新コミット `dcffc89`）  
> **作成方針**: これまでの意思決定・リポジトリの実コード・設計ドキュメントの事実のみを記載し、憶測は含めません。未確定・未確認の事項は「7. 未確定事項・不明点・今後の課題」に明記します。

---

## 1. プロジェクトの背景と目的

複数の Slack ワークスペース（年度ごとに新設されるワークスペースや複数チームのワークスペース）において、予定の登録漏れや確認漏れを防ぐため、**Google Gemini API と Google カレンダーを連携させた Slack Bot** を開発・配布するプロジェクトです。

### 対象プロダクト（現時点：2アプリ体制）
1. **`apps/message-calendar-bot`**: Slack のメッセージから AI（Gemini）を用いて予定を読み取り、Google カレンダーへ登録する Bot。
2. **`apps/calendar-reminder-bot`**: Google カレンダーに登録されている予定を取得し、Slack へリマインド通知する Bot。

### 主な達成目標
- **完全無料枠での運用**: Web サーバー（Render Free）、DB（TiDB Cloud Serverless）、AI（Gemini API 無料枠）、定期実行（`cron-job.org`）をすべて無料枠内で稼働させる。
- **複数ワークスペース配布の省力化**: 年度替わりや新規ワークスペース追加のたびに開発者が手動でトークン発行・環境変数設定・再デプロイを行わなくて済むよう、OAuth 2.0 による配布 URL から導入できる仕組みを実現する。
- **非エンジニア向けの直感的な操作**: スラッシュコマンドの手打ちを廃止し、Slack の GUI 操作（App Home・モーダル・ボタン・プルダウン）に一本化する。

### 方針変更により削除・除外された要素（経緯）
- **`apps/excel-calendar-bot`（および `xlsx` パッケージ）**: 当初は 3つ目の Bot として Excel からの年間予定一括登録を実装していたが、今回開発しない方針となり、コード・テスト・パッケージ・環境変数定義を削除済み（コミット `e01d782`）。
- **旧サンプル・検証用アプリ**: `apps/sample-slack-app`、`apps/app-test-yochipen`、`app-oauth.js` およびそれらに紐づく旧テストは削除済み（コミット `e11d3a2`）。
- **スラッシュコマンド**: 当初実装した `/set-calendar`, `/set-reminder-channel`, `/check-today` は GUI 一本化に伴い廃止・削除済み。

---

## 2. 合意済みのアーキテクチャ・技術方針

| 領域 | 確定方針 | 根拠・詳細 |
| :--- | :--- | :--- |
| **ホスティング構成** | **単一プロセス・マルチ Bot 相乗り**（Render Web Service Free 1インスタンス） | Render 無料枠はアカウント合計で月 750 時間（≒1インスタンス常時稼働分）のため、2つの個別 Bot を1つの Node.js プロセス（`app.js`）に同居させる |
| **Slack 配布・認証** | **本格配布レベル1（OAuth 2.0 Direct Install）**<br>※ ローカル開発時は **Socket Mode** も両対応 | `lib/slack-app-factory.js` により、OAuth 用環境変数（`*_CLIENT_ID` 等）があれば `HTTPReceiver`、Socket Mode トークンがあれば Socket Mode、どちらも未設定なら `null` で安全にスキップする |
| **Google カレンダー連携** | **案A：サービスアカウント共有方式** | Google Cloud プロジェクトおよび Gemini API キーはチーム共通アカウント（`akitacore.stamina@gmail.com`）で管理。各ワークスペースの利用者が、対象 Google カレンダーの共有設定にサービスアカウントのメールアドレスを「予定の変更権限」で追加して連携する |
| **UI / UX** | **GUI 一本化（案1 + 案2 併用）** | ・**案1**: 各 Bot の App Home ダッシュボード ＋ モーダル設定フォーム（カレンダー ID 入力、`conversations_select` によるチャンネルプルダウン選択）<br>・**案2**: OAuth インストール完了直後に導入ユーザーへ「⚙️ 初期設定をはじめる」ボタン付きウェルカム DM を自動送信 |
| **DB 変更管理** | **Prisma Migrate（`prisma/migrations/`）** | `db push` ではなくマイグレーション SQL で履歴管理する。過去の状態へ戻したい場合も、元に戻すための新しいマイグレーションを作成する（ロールフォワード） |
| **ワークスペース識別子** | **`workspaceId` / `workspaceName` へ統一** | Slack API / Bolt 内部の `team.id` / `team_id` / `teamId` は、OAuth ストアやリスナーの入口で吸収し、アプリ内部コード・DB カラムはすべて `workspaceId` に統一する |

---

## 3. 技術スタック（`package.json` 基準）

| カテゴリ | 採用技術・バージョン |
| :--- | :--- |
| 言語・モジュール | Node.js / ES Modules（`"type": "module"`） |
| Slack フレームワーク | `@slack/bolt` `^5.1.0` |
| DB / ORM | MySQL 互換（ローカル: XAMPP / 本番: TiDB Cloud Serverless）、Prisma 7（`prisma`, `@prisma/client`, `@prisma/adapter-mariadb` `^7.10.1`、`mariadb` `^3.5.4`、設定ファイル: `prisma7.config.ts`） |
| AI / Google API | `@google/genai` `^3.3.0`（デフォルトモデル: `gemini-2.5-flash`）、`googleapis` `^190.0.0` |
| 環境変数 | `dotenv` `~18.0.4` |
| 静的解析・整形 | `@biomejs/biome` `^2.5.14`（スペース2・シングルクォート・LF・120桁） |
| テスト | Node.js 標準テストランナー（`node:test` / `node:assert`） |

---

## 4. リポジトリの現状（実装状況）

現在、`update/project_setting` の基盤実装は `main` へマージ済み（PR #7）であり、後続の `delete/test_app` ブランチにて **不要アプリの削除** および **2つの Bot の業務処理の最小骨組み化（要件再定義に向けたリセット）** が完了しています。

### 4.1 基盤・共通モジュール（実装済み・テスト済み）

| パス | 役割・現状 |
| :--- | :--- |
| `app.js` | 統合 HTTP サーバー兼オーケストレーター（`PORT \|\| 3000`）。`GET /`, `GET /health`、`POST /cron/remind`、および `/slack/<appName>/{install,oauth_redirect,events}` の動的ルーティングを実装済み |
| `apps/index.js` | `apps/` 配下の各 Bot の `initApp(env, options)` を自動走査・ロードし、例外を隔離するローダー |
| `lib/prisma.js` | PrismaClient シングルトン（`DATABASE_URL` 未設定・プレースホルダー時は `null`） |
| `lib/slack-installation-store.js` | `@slack/bolt` 互換の Prisma ベース OAuth `InstallationStore`（`appName` + `workspaceId` 複合ユニーク） |
| `lib/slack-app-factory.js` | OAuth モード（`HTTPReceiver` + インストール直後 DM コールバック）と Socket Mode の両対応初期化ファクトリ |
| `lib/slack-setup-ui.js` | 全 Bot 共通の App Home ダッシュボード、設定モーダル、保存後のホーム再描画、ウェルカム DM 送信モジュール |
| `lib/google-calendar.js` | サービスアカウント JWT 認証クライアント生成、ワークスペース設定取得・保存（`getWorkspaceCalendarConfig` / `upsertWorkspaceCalendarConfig`）、単発予定登録（`insertEvent`）、当日予定取得（`getUpcomingEvents`） |
| `routes/cron.js` | `POST /cron/remind` ハンドラー（`CRON_SECRET` を `crypto.timingSafeEqual` で検証し、`calendar-reminder-bot` トークンで配信を呼び出す） |
| `prisma/schema.prisma` | `SlackInstallation`（`slack_installations`）および `WorkspaceCalendarConfig`（`workspace_calendar_configs`）を定義済み。初回マイグレーション `prisma/migrations/20261113060830_init/migration.sql` 作成済み |

### 4.2 要件再定義に向けて最小骨組み（スタブ）に戻している箇所

2つの Bot の具体的な機能要件・プロンプトを改めて設計し直すため、以下の箇所は **インターフェイス（器）とエラー隔離の骨組みのみ** 残した状態です。

| パス | 現状 |
| :--- | :--- |
| `lib/gemini.js` | `createGeminiClient`, `generateText`, `extractEventFromMessage` の共通インターフェイスのみ保持（固定プロンプトおよび JSON スキーマ定義は削除済み） |
| `apps/message-calendar-bot/listeners/events/reaction-added.js` | `reaction_added` の受信・`workspaceId` 取得・`try...catch` の最小骨組みのみ（メッセージ取得・AI 抽出・Google カレンダー登録の具体的処理は未接続） |
| `apps/calendar-reminder-bot/services/reminder-service.js` | `formatReminderMessage`（タイトル列挙の最小実装）と `sendDailyReminders`（設定済みワークスペースの走査と個別 `try...catch` 隔離の骨組み）のみ（具体的なカレンダー取得・整形・Slack 投稿は未接続） |

### 4.3 テスト・検証の現状
- **`npm test`**: 全 **13スイート・55テスト PASS**（失敗 0件）。
- **DB マイグレーション**: `prisma/migrations/20261113060830_init/migration.sql` 作成済み（`workspace_id` / `workspace_name` 反映済み）。
- **ローカル環境変数設定**: 開発者手元にて共通環境変数（DB・Gemini API キー・Google サービスアカウント JSON キー）の設定が進行中。ローカルでの個人テスト用 Slack App 作成手順書（`docs/wiki-local-slack-app-setup-guide.md`）を作成済み。

---

## 5. ドキュメント・エージェント向けルール構成

| ファイル / ディレクトリ | 役割 | Git管理 |
| :--- | :--- | :---: |
| `AGENTS.md` | **AI エージェント・開発ルール正本**（ペルソナ、GUI ファースト、Fault Isolation、`workspaceId` 統一、Prisma 規約、完了ゲート）。`CLAUDE.md` / `GEMINI.md` から参照 | ⭕ |
| `.agents/skills/` & `.claude/skills/` | タスク別スキル定義（`create-slack-app`, `add-slack-listener`, `code-review-and-qa`, `skill-auditor` 等）。両ディレクトリを同期管理 | ⭕ |
| `docs/specs/REQUIREMENTS.md` | プロジェクト全体の要件定義書（確定済みの基盤要件・スコープ・対象外項目、および再定義予定の TBD 項目を記載） | ⭕ |
| `docs/specs/{COMPONENT_SPEC,BASIC_DESIGN,DETAIL_DESIGN,LIBRARY_ARCHITECTURE_SPEC,PROCESS_DESIGN}.md` | システム設計書群（※ 一部に旧構成の記述が残存。詳細は「7. 未確定事項・不明点」参照） | ⭕ |
| `docs/wiki-*.md` | GitHub Wiki 転記用の手順書原稿（環境構築、DB セットアップ、マイグレーション運用、ローカル Slack App 作成、OAuth 本番設定等） | ❌（`.gitignore` 対象） |
| `private/docs/pr/` | PR 説明文の下書き置き場 | ❌（`README.md` のみ管理） |

---

## 6. 開発・運用上の絶対ルール（エージェント・メンバー共通）

1. **相乗り安全性の確保（Fault Isolation）**: 環境変数未設定・`YOUR_*` プレースホルダー時は例外を投げず `null` を返してスキップすること。すべてのリスナー・ルートを `try...catch` で保護し、インタラクション系（`actions`, `views` 等）は冒頭で `await ack()` を呼ぶこと。
2. **命名・コメント・スタイル**: ファイル・ディレクトリ名はすべてケバブケース。ES Modules（相対インポートに `.js`、組み込みに `node:`）。初学者に配慮した JSDoc・`//` 説明コメントを必ず記述すること。
3. **Prisma 規約**: 全テーブルに `id Int @id @default(autoincrement())`、`createdAt`、`updatedAt`、各カラム行末の日本語コメントを設けること。スキーマ変更時は `npx prisma migrate dev --name <name> --config prisma7.config.ts` を使用すること。
4. **ローカル並行開発時の衝突防止**: Socket Mode のイベント分散を防ぐため、各開発者は自分専用の個人テスト用 Slack App を作成し、ローカル `.env` では OAuth 用環境変数（`*_CLIENT_ID` 等）を `YOUR_...` のままにすること。
5. **秘密情報の保護**: 実トークン（`xoxb-`, `xapp-`）、`CLIENT_SECRET`、Google サービスアカウント JSON キー、`GEMINI_API_KEY`、`CRON_SECRET` をコードや `.env.sample` に記載・コミットしないこと。

---

## 7. 未確定事項・不明点・今後の課題

現時点で決定していない事項および未確認の課題を以下に整理します。後続の要件定義・設計・実装フェーズで順次確定する必要があります。

1. **`message-calendar-bot` の具体的な機能要件（TBD）**
   - 起動トリガー（`reaction_added` のままか、メンションやメッセージショートカット等にするか）、対象絵文字、Gemini へ渡すプロンプト設計・抽出 JSON スキーマ、登録前のユーザー確認ステップの有無、重複登録防止の仕様、返信メッセージ形式はこれから再定義予定。
2. **`calendar-reminder-bot` の具体的な機能要件（TBD）**
   - リマインドの配信タイミング・頻度（毎朝のみか、予定開始前通知も含むか）、取得対象期間（当日のみか翌日・週間も含むか）、通知メッセージのフォーマット、App Home の「今日の予定を今すぐ確認」ボタンを残すか見直すかはこれから再定義予定。
3. **既存設計書の一部と最新実装のギャップ**
   - `AGENTS.md`・`docs/specs/REQUIREMENTS.md`・各スキルは最新の 2アプリ / OAuth / GUI / Prisma Migrate 構成へ更新済みですが、`docs/specs/COMPONENT_SPEC.md`, `BASIC_DESIGN.md`, `DETAIL_DESIGN.md`, `PROCESS_DESIGN.md`, `LIBRARY_ARCHITECTURE_SPEC.md` には初期構成時の記述（Socket Mode のみ、`db push`、`sample-slack-app`、モデル未定義等）が残っています。機能要件の再定義と合わせて同期更新が必要です。
4. **各 Bot 内の雛形メッセージリスナー（`sample-message.js`）の扱い**
   - `apps/message-calendar-bot/listeners/messages/sample-message.js` および `apps/calendar-reminder-bot/listeners/messages/sample-message.js`（`hi` / `hello` / `hey` に応答する `create:app` 生成時の雛形）が残存しています。本番運用前に削除するか、動作確認用として残すかは未確認です。
5. **Windows 環境における `npm run lint` の改行コード（CRLF）差分**
   - `biome.json` は `"lineEnding": "lf"` を指定していますが、Windows 環境での Git チェックアウト設定により既存ファイルが `CRLF` となり、リポジトリ全体に対する `npm run lint` でフォーマット差分エラーが発生する状況があります。`.gitattributes` による LF 固定や一括フォーマット PR の実施有無は未決定です。
6. **本番環境（Render / TiDB Cloud / `cron-job.org` / 本番用 Slack App）の構築・実機検証**
   - 手順書（`docs/wiki-oauth-setup-guide.md`）とコード基盤は準備済みですが、本番環境での OAuth インストール・Google カレンダー実連携・Cron 実配信の E2E 動作確認は未実施です。
7. **個人 Google カレンダー連携機能（次期フェーズ検討課題）**
   - ワークスペース共有カレンダー（案A）ではなく、ユーザー個人のカレンダーに対する予定追加・修正・削除機能については「今後検討する」方針となっており、採用可否・認証方式・開発時期は未定です。
