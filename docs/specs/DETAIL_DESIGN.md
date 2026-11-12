# 詳細設計書

## 1. 目的

本書は、ディレクトリ構成、主要モジュールの責務、環境変数、データモデル、テスト配置、および変更時に更新すべき箇所を定義します。

---

## 2. ディレクトリ構成

| パス | 役割 |
| :--- | :--- |
| `app.js` | エントリポイント。HTTPヘルスチェックサーバー（`process.env.PORT || 3000`）の起動と、`loadAllApps()` で取得した全 Bot の `Promise.all` 並行起動 |
| `app-oauth.js` | OAuth（配布型インストール）で単一 Bot を動かす場合の参考実装。通常の開発・運用では使用しない |
| `apps/index.js` | `apps/` 直下のディレクトリを走査し、各 Bot の `initApp(env, options)` を呼び出して有効な App インスタンス配列を返すローダー |
| `apps/<app-name>/index.js` | Bot の初期化。`<PREFIX>_BOT_TOKEN` / `<PREFIX>_APP_TOKEN` を検証し、無効なら `null` を返す |
| `apps/<app-name>/manifest.json` | Slack App Manifest（スコープ・購読イベント・コマンド・ショートカット定義） |
| `apps/<app-name>/listeners/` | `events` / `messages` / `commands` / `actions` / `shortcuts` / `views` のカテゴリ別リスナーと、各カテゴリの `index.js`（`register(app)`） |
| `apps/<app-name>/services/` | 外部API連携・業務ロジック（例: `ai-event-extractor.js`, `google-calendar.js`）。必要になった Bot のみ作成する |
| `lib/prisma.js` | 全 Bot で共有する PrismaClient。`DATABASE_URL` 未設定時は `null` を返す |
| `prisma/schema.prisma` | DB スキーマ定義（`provider = "mysql"`） |
| `prisma7.config.ts` | Prisma 7 の設定（スキーマパス・マイグレーションパス・接続URL） |
| `scripts/create-app.js` | `npm run create:app <app-name>` で Bot 雛形と `.env` / `.env.sample` のトークン枠を生成する CLI |
| `tests/` | `node:test` による単体テスト（`*.spec.js`）。カテゴリ別ディレクトリ（`actions/`, `events/` 等）に配置 |
| `docs/specs/` | 設計仕様書（本ディレクトリ） |
| `docs/guidelines/` | 開発ガイドライン |
| `private/docs/` | ADR・日報・PR下書き |
| `.agents/skills/` / `.claude/skills/` | AI エージェント向けタスク別スキル（同一内容を二重配置） |

---

## 3. 主要モジュールのインターフェース

### 3.1 Bot 初期化関数 `initApp(env, options)`

| 項目 | 仕様 |
| :--- | :--- |
| 配置 | `apps/<app-name>/index.js`（名前付きエクスポート） |
| 引数 | `env`: 環境変数オブジェクト（既定値 `process.env`。テストでは任意のオブジェクトを注入）、`options`: `App` コンストラクタへの追加オプション |
| 戻り値 | 有効なトークンがあれば `App` インスタンス（`app.name` にディレクトリ名を設定）、無効なら `null` |
| 例外 | トークン不備で例外を投げてはならない |
| テスト時 | `env.NODE_ENV === 'test'` のとき `tokenVerificationEnabled: false` |

### 3.2 リスナーコールバック

| 項目 | 仕様 |
| :--- | :--- |
| 配置 | `apps/<app-name>/listeners/<category>/<kebab-case>.js` |
| エクスポート | 単体テストから直接呼べるよう名前付きエクスポート（例: `sampleCommandCallback`） |
| 例外処理 | 本体全体を `try...catch` で囲み、`catch` で `logger.error(error)` を呼ぶ |
| ack | `commands` / `actions` / `shortcuts` / `views` は `try` の最初で `await ack()` |
| 登録 | カテゴリ別 `index.js` の `register(app)` → `listeners/index.js` の `registerListeners(app)` |

---

## 4. 環境変数

| 変数名 | 用途 | 必須 | 備考 |
| :--- | :--- | :--- | :--- |
| `<PREFIX>_BOT_TOKEN` | 各 Bot の Bot User OAuth Token（`xoxb-...`） | Bot ごと | `<PREFIX>` はアプリ名を大文字・アンダースコア化したもの（例: `SAMPLE_SLACK_APP`） |
| `<PREFIX>_APP_TOKEN` | 各 Bot の App-Level Token（`xapp-...`、`connections:write`） | Bot ごと | 同上 |
| `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` | `sample-slack-app` のフォールバック用トークン | 任意 | 新規 Bot では使用しない |
| `DATABASE_URL` | MySQL 接続URL | DB利用時 | ローカル: `mysql://root:@localhost:3306/slack_app_db` / 本番: TiDB の接続URL |
| `PORT` | ヘルスチェックサーバーのポート | 任意 | 既定値 `3000` |
| `NODE_ENV` | 実行モード（`test` / `production`） | 任意 | `test` で外部通信を抑止 |
| `SLACK_API_URL` | Slack API の接続先上書き | 任意 | テスト・検証用 |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | `app-oauth.js` 用 | 任意 | 通常運用では未使用 |

外部APIを使う機能を追加した場合（例: `GEMINI_API_KEY`, `GOOGLE_*`）は、`.env.sample` にプレースホルダー（`YOUR_*`）を追記し、本表にも追加します。

---

## 5. データモデル

- スキーマの正本は `prisma/schema.prisma` です。現時点ではアプリケーション固有のモデルは定義されていません。
- モデルを追加する場合は以下の規約に従います。
  - モデル名は PascalCase 単数形、テーブル名は `@@map("snake_case_plural")` で明示する（例: `model CalendarEvent { ... @@map("calendar_events") }`）。
  - 複数の Bot が同じDBを共有するため、Bot 固有のテーブルには用途が分かる接頭辞または列（例: `appName`）を付け、他 Bot のデータと混在させない。
  - Slack の ID（ユーザーID・チャンネルID・メッセージ `ts`）は文字列型で保存する。
  - 二重登録を防ぐ必要があるデータ（例: 同じメッセージからのカレンダー登録）には一意制約（`@@unique`）を設定する。
- スキーマ変更後は `npx prisma db push` と `npx prisma generate` を実行し、本節に主要テーブルを追記します。

---

## 6. テスト配置と方針

| 区分 | 配置 | 目的 | 優先度 |
| :--- | :--- | :--- | :--- |
| Bot 初期化テスト | `tests/apps/` | トークン未設定・プレースホルダー時の `null` 返却、有効時のインスタンス生成 | **高** |
| リスナーテスト | `tests/<category>/` | `ack` / `say` / `respond` / `client.*` の呼び出し（正常系）と、例外時に `logger.error` が呼ばれること（異常系） | **高** |
| サービステスト | `tests/services/` | 外部APIをモックした上での変換ロジック・エラー分岐 | **高** |
| スクリプト・共通ライブラリ | `tests/scripts/`, `tests/prisma.spec.js` | 雛形生成、DBクライアントの初期化分岐 | **中** |

- 1つのリスナー・サービスにつき、**正常系と異常系の2ケース以上**を必須とします（詳細: [`add-slack-listener`](../../.agents/skills/add-slack-listener/SKILL.md) Gate 4）。
- Slack API・外部API・DB への実通信はモック（`node:test` の `mock.fn()`）で置き換えます。

---

## 7. 変更時の更新対象マトリクス

| 変更種別 | 同一PRで更新必須の対象 |
| :--- | :--- |
| 新規 Bot 追加 | `apps/<app-name>/` 一式 + `.env.sample` + テスト（`create-slack-app` スキル） |
| リスナー追加・変更 | リスナー + カテゴリ `index.js` + `manifest.json`（スコープ・イベント・コマンド）+ テスト（`add-slack-listener` スキル） |
| 外部API連携の追加 | `services/` + テスト + `.env.sample` + 本書「4. 環境変数」 + `docs/specs/SPEC-NNNN-*.md` |
| DBスキーマ変更 | `prisma/schema.prisma` + 利用コード + テスト + 本書「5. データモデル」 |
| 基盤（`app.js` / `apps/index.js` / `lib/`）の変更 | 対象コード + テスト + 本書 + [`LIBRARY_ARCHITECTURE_SPEC.md`](LIBRARY_ARCHITECTURE_SPEC.md) |
| 後戻りしにくい設計判断 | [`private/docs/adr/`](../../private/docs/adr/README.md) |
| 起動・開発・デプロイ手順の変更 | [`PROCESS_DESIGN.md`](PROCESS_DESIGN.md) + `README.md` + 該当する `docs/wiki-*.md` |

