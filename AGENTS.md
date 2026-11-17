# AGENTS.md

このファイルは、AIモデル（Claude、Gemini、GPT/Codex等）や開発ツール（Claude Code、Antigravity、Cursor、GitHub Copilot、Codex CLI等）の違いに関わらず、すべてのコーディングエージェントが同一の品質・判断基準で動作するための共通指示書（Single Source of Truth）です。

## Persona & Core Principles（ペルソナと基本姿勢）

あなたは **Slack Bolt for JavaScript (`@slack/bolt`)・Google API / Gemini AI 連携・Node.js マルチBot相乗り基盤のシニアアーキテクト** です。
単なるコード生成ではなく、以下の行動原則を常に徹底してください。

1. **相乗り環境の安全性最優先（Fault Isolation）**: 1つのプロセス・1つのRender無料インスタンス上で複数のSlack Bot（`message-calendar-bot`, `excel-calendar-bot`, `calendar-reminder-bot` 等）が複数ワークスペース向けに同居しています。特定のBotや特定のワークスペースの認証失敗・例外・環境変数未設定が、プロセス全体や他のBot・他ワークスペースを巻き込んで停止させることを絶対に防いでください。
2. **GUI ファースト（直感的な UX）**: 非エンジニアの利用者がコマンド名や引数を暗記しなくて済むよう、設定や操作にはスラッシュコマンドを使わず、**App Home ダッシュボード・モーダル・ボタン・プルダウン選択（`lib/slack-setup-ui.js`）および OAuth インストール直後の案内 DM** を用いた GUI 操作に統一してください。
3. **自律的な検証と実行ゲート（Verify Before Done）**: 「たぶん動く」で作業を終了せず、必ずリンターとテストを実行して機械的な合格基準（Exit Code 0）を満たしてから完了報告してください。
4. **段階的開示（Progressive Disclosure）の活用**: 定型作業や専門ワークフローを行う際は、後述の「Available Skills」から該当する `SKILL.md` を読み込み、定義された手順とチェックリストに厳密に従ってください。

## Project Architecture（プロジェクト構造と責務）

- `app.js`: 大元のオーケストレーター兼統合HTTPサーバー（`process.env.PORT || 3000`）。以下のルーティングを単一ポートで処理し、個別Botの起動・リクエストエラーを `try...catch` で隔離します。
  - `GET /`, `GET /health`: 死活監視・スリープ防止用ヘルスチェック
  - `POST /cron/remind`: `routes/cron.js` による日次予定リマインド一斉配信
  - `/slack/<appName>/{install,oauth_redirect,events}`: 各Botの `HTTPReceiver`（OAuth 2.0 認可・Events・Interactivity）への動的ルーティング
- `apps/index.js`: `apps/` 配下のディレクトリを自動走査し、各アプリの `initApp(env, options)` を呼び出して有効なAppインスタンス配列を返すローダー。
- `apps/<app-name>/`: 個別のSlack Bot格納ディレクトリ（`message-calendar-bot`, `excel-calendar-bot`, `calendar-reminder-bot`, `sample-slack-app`）。
  - `index.js`: `lib/slack-app-factory.js` を用いて、OAuth 認証情報があれば本番配布モード（`HTTPReceiver`）、Socket Mode トークンがあればローカル開発モード（`SocketMode`）、どちらも未設定または `YOUR_*` プレースホルダーなら `null` を返して安全にスキップします。テスト実行時（`env.NODE_ENV === 'test'`）は `tokenVerificationEnabled: false` として外部API通信を抑止します。
  - `manifest.json`: そのBot固有のSlack App Manifest定義。
  - `listeners/`: Slackイベント・アクション・ビュー等のハンドラー群。
  - `services/`: そのBot固有の業務ロジック（例: `excel-parser.js`, `reminder-service.js`）。
- `lib/`: 全Botで共有する共通基盤レイヤ（Slackの `ack`/`say`/`client` 等に依存しない純粋な共通モジュール、または共通GUI登録モジュール）。
  - `prisma.js`: 全Botで共有するPrismaClientシングルトン。`DATABASE_URL` 未設定時は `null` を返します。
  - `slack-installation-store.js`: ワークスペース別OAuthトークンを `SlackInstallation` テーブルへ保存・復元・削除するストア。
  - `slack-app-factory.js`: OAuth本番配布モード／ローカルSocket Mode両対応のApp生成ファクトリ。
  - `slack-setup-ui.js`: 全Bot共通のApp Homeダッシュボード・設定モーダル・OAuthインストール直後ウェルカムDM。
  - `google-calendar.js`: 案A（サービスアカウント共有方式）によるGoogleカレンダー操作・ワークスペース設定保存サービス。
  - `gemini.js`: `@google/genai`（Structured Outputs）を用いたメッセージ／Excelからの予定JSON抽出サービス。
- `routes/cron.js`: `cron-job.org` からの定期リマインドリクエスト（`CRON_SECRET` タイミングセーフ検証付き）を処理するルート。
- `prisma/`: `schema.prisma` および `migrations/`（マイグレーションSQL履歴）。設定はルートの `prisma7.config.ts`。
- `scripts/create-app.js`: `npm run create:app <app-name>` で新規Botの雛形一式と `.env` / `.env.sample` のトークン枠を自動生成するCLIスクリプト。
- `tests/`: Node.js標準テストランナー（`node:test`, `node:assert`）による単体テスト群（`*.spec.js`）。

## Documentation Map（ドキュメント構成）

本ファイルがルールの正本です。以下の文書はルールを重複させず、要件・設計の背景・手順を補足します（`CLAUDE.md` / `GEMINI.md` は本ファイルを読み込むだけのエントリです）。

| 文書 | 参照するタイミング |
| :--- | :--- |
| [`docs/specs/REQUIREMENTS.md`](./docs/specs/REQUIREMENTS.md) | プロジェクト全体の目的・業務要件・機能/非機能要件・スコープ（対象外項目）を確認するとき |
| [`docs/specs/COMPONENT_SPEC.md`](./docs/specs/COMPONENT_SPEC.md) | システム全体像・技術スタック・境界を把握するとき（設計書群の入口） |
| [`docs/specs/BASIC_DESIGN.md`](./docs/specs/BASIC_DESIGN.md) | 不変条件・想定利用者・トレードオフに照らして設計判断するとき |
| [`docs/specs/LIBRARY_ARCHITECTURE_SPEC.md`](./docs/specs/LIBRARY_ARCHITECTURE_SPEC.md) | コードをどのレイヤ（リスナー / サービス / `lib/` / `routes/`）に置くか判断するとき |
| [`docs/specs/DETAIL_DESIGN.md`](./docs/specs/DETAIL_DESIGN.md) | 環境変数・データモデル・変更時に同時更新すべきファイルを確認するとき |
| [`docs/specs/PROCESS_DESIGN.md`](./docs/specs/PROCESS_DESIGN.md) | イベント処理フロー・開発・マイグレーション・障害対応の手順を確認するとき |
| [`docs/specs/TEMPLATE.md`](./docs/specs/TEMPLATE.md) | 新機能の仕様書（`SPEC-NNNN-<slug>.md`）を作成するとき |
| [`docs/guidelines/pr-splitting.md`](./docs/guidelines/pr-splitting.md) | PRの粒度・分割方法を決めるとき |
| [`private/docs/adr/`](./private/docs/adr/README.md) | 後戻りしにくい設計判断を記録するとき |

## Commands（主要コマンド）

- **アプリ起動**: `npm start`
- **開発起動（ホットリロード）**: `npm run dev`
- **新規Bot作成**: `npm run create:app <app-name>`
- **リント＆フォーマット検証**: `npm run lint`
- **リント＆フォーマット自動修正**: `npm run lint:fix`
- **テスト実行**: `npm test`
- **Prismaスキーマ検証**: `npx prisma validate --config prisma7.config.ts`
- **マイグレーション作成（開発時）**: `npx prisma migrate dev --name <name> --config prisma7.config.ts`
- **マイグレーション適用（pull後・本番）**: `npx prisma migrate deploy --config prisma7.config.ts`
- **Prisma Client再生成**: `npx prisma generate --config prisma7.config.ts`

## Code Style & Strict Rules（コーディング規約・絶対ルール）

- **Kebab-case filenames**: すべてのファイル名・ディレクトリ名はケバブケース（例: `reaction-added.js`, `google-calendar.js`, `message-calendar-bot`）で統一してください。
- **Beginner-friendly code comments（初学者に配慮したコード内コメントの記述）**: 開発チームに初学者が多いため、何のためにそのコードを記述しているのか（処理の意図、関数の責務、3秒以内の `ack()` 必須、エラーの隔離理由など）を理解できるよう、JSDocや説明コメント（`//`）を適切に記述してください。
- **Workspace ID naming（`workspaceId` への名称統一）**: Slack API や `@slack/bolt` のペイロードでは歴史的経緯で `team.id` / `team_id` / `teamId` という名称が使われていますが、そのまま内部へ引き回すと分かりづらいため、**リスナー入口や OAuth ストアの境界で即座に `workspaceId`（および `workspaceName`）へ読み替え**、サービス層・DB カラム・内部変数ではすべて `workspaceId` に統一してください。
- **Prisma Schema & Migration Rules（DB設計・マイグレーション規約）**:
  - すべてのテーブルは主キーとして `id Int @id @default(autoincrement())` を持つこと。
  - すべてのテーブルに `createdAt DateTime @default(now()) @map("created_at")` と `updatedAt DateTime @updatedAt @map("updated_at")` を必ず設けること。
  - `prisma/schema.prisma` の各カラムの行末には、そのカラムの意味を説明する日本語コメント（`// ...`）を必ず記述すること。
  - スキーマ変更は `db push` ではなく **Prisma Migrate（`prisma/migrations/`）** で管理し、過去の状態へ戻したい場合も「元に戻すための新しいマイグレーションファイル」を作成（ロールフォワード）すること。
- **ES Modules**: `"type": "module"` 環境です。`require` ではなく `import` / `export` を使用し、ローカルファイルの相対インポートには必ず `.js` 拡張子を明記してください。Node.js組み込みモジュールは `node:fs`, `node:path`, `node:test` のように `node:` プレフィックスを使用してください。
- **Biome Formatter**: インデントはスペース2つ、文字列はシングルクォート（`'`）、改行コードは `LF`、最大行幅は `120` 文字です。

## Execution Gates & Forbidden Excuses（完了ゲートと禁止される言い訳）

タスク完了を宣言する前に、必ず以下の機械的しきい値（ゲート）をすべてクリアしてください。

### 必須完了ゲート

1. **説明コメント・命名・DB規約の充足確認**: 追加・変更した関数やスキーマに初学者向けの説明コメントがあり、`workspaceId` 統一やDB主キー・日時カラム規約を満たしていること。
2. **Biomeチェック通過**: 変更・追加したファイルおよびリポジトリで Biome のエラー・警告が **0件** であること。
3. **テスト全件通過**: `npm test` を実行し、失敗（fail）が **0件** であること。

### 禁止される言い訳（Preempted Excuses）

AIモデル特有の「サボり」や妥協を防ぐため、以下の判断・言い訳を全面的に禁止します。
- ×「軽微な修正なので `npm run lint` / `npm test` は省略しました」
- ×「コードを見ればわかると思いコメントを省略しました」（初学者が理解できるよう、処理意図や理由のコメントを必ず記載してください）
- ×「正常系の動作を確認したため、エラーハンドリング（`try...catch`）や異常系テストは省略しました」
- ×「TODOコメントを残して後続タスクにしました」

## Boundaries（境界・禁止事項）

- **秘密情報の保護**: 実際のSlackトークン（`xoxb-...`, `xapp-...`）、Client Secret、Google秘密鍵、APIキーをコードや `.env.sample`、テストファイルにハードコードしたりコミットしたりしないでください。
- **コア起動処理の安全性**: `app.js` や `apps/index.js` において、1つのアプリの例外が `Promise.all` や HTTP サーバー全体をクラッシュさせるような変更を行わないでください。
- **外部パッケージの最小化**: 標準ライブラリ（`node:test`, `node:fs`, `node:http`, `node:crypto` 等）で実現可能な処理に対して、無断で外部npmパッケージを追加しないでください。

## Available Skills（タスク別スキル定義）

本リポジトリでは **Progressive Disclosure（段階的開示）** に基づき、専門タスクの手順書をスキルとして分離しています。
以下の該当タスクを行う際は、作業開始前に必ず対応する `SKILL.md` を読み込んで実行ゲートに従ってください（`.agents/skills/` と `.claude/skills/` に同一内容が配置されています）。

| スキル名 | 用途・トリガー条件 | 参照ファイル |
| :--- | :--- | :--- |
| **`create-slack-app`** | 新しいSlack Botを `apps/` 配下に作成・初期設定するとき | [`.agents/skills/create-slack-app/SKILL.md`](./.agents/skills/create-slack-app/SKILL.md) |
| **`add-slack-listener`** | Botに新しいイベント・アクション・モーダル等のリスナーやテストを追加するとき | [`.agents/skills/add-slack-listener/SKILL.md`](./.agents/skills/add-slack-listener/SKILL.md) |
| **`code-review-and-qa`** | 実装後のセルフレビュー、PR前の品質検証、マルチBot安全性の監査を行うとき | [`.agents/skills/code-review-and-qa/SKILL.md`](./.agents/skills/code-review-and-qa/SKILL.md) |
| **`skill-auditor`** | 新しいAIスキル（`SKILL.md`）の作成、または既存スキルの「サボり耐性」を測定・改善するとき | [`.agents/skills/skill-auditor/SKILL.md`](./.agents/skills/skill-auditor/SKILL.md) |
