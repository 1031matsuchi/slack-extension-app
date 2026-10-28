# slack-extension-app

1つのプロセスで複数の Slack Bot を同時稼働させるマルチ Bot 相乗り環境です。HTTP ヘルスチェックサーバー（デフォルトポート 3000）を内蔵しており、Render などのホスティング環境で常時稼働できます。

## 必要要件

- Node.js 18 以上

## セットアップ

1. 依存関係のインストール:

   ```sh
   npm install
   ```

2. 環境変数の設定:
   `.env.sample` を `.env` にコピーし、各アプリのトークンを設定します。

   ```sh
   cp .env.sample .env
   ```

   `apps/ma-app-01` 用の環境変数:
   - `MA_APP_01_BOT_TOKEN`（または `SLACK_BOT_TOKEN`）: `xoxb-...`
   - `MA_APP_01_APP_TOKEN`（または `SLACK_APP_TOKEN`）: `xapp-...`

   ※ トークンが未設定またはプレースホルダーのアプリは起動時に安全にスキップされます。

## コマンド

- **起動**: `npm start`（開発時: `npm run dev`）
- **新規 Bot の生成**: `npm run create:app <アプリ名>`
  `apps/<アプリ名>/` 配下に雛形を一括生成し、`.env` および `.env.sample` にトークン定義を自動追記します。
- **テスト**: `npm test`
- **リント**: `npm run lint`

## ディレクトリ構成

- `app.js`: エントリポイント（全 Bot 並行起動 & HTTP ヘルスチェック）
- `apps/`: 各 Slack Bot の格納ディレクトリ
  - `apps/index.js`: `apps/` 直下のアプリを自動検出・初期化するローダー
  - `apps/<アプリ名>/`: 各 Bot の `index.js`, `manifest.json`, `listeners/`
- `scripts/create-app.js`: 新規 Bot 自動生成 CLI
