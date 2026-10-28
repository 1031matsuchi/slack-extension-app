---
name: create-slack-app
description: >-
  新しいSlack Botアプリを `apps/<app-name>/` 配下に生成・初期構築する際に使用するスキル。
  ユーザーが「新しいBotを追加して」「新規アプリを作って」「create:appを実行して」と依頼した際に起動する。
---

# 新規 Slack Bot 作成・初期構築スキル (`create-slack-app`)

本リポジトリのマルチBot相乗りアーキテクチャにおいて、既存のBotに影響を与えずに新しいSlack Botを追加するための標準手順と実行ゲートを定義します。

## 失敗コストの認識（なぜ手順を厳守するか）

- 手動で不完全なディレクトリを `apps/` に作成すると、`apps/index.js` の自動走査時にロードエラーが発生し、ログ汚染や起動トラブルの原因となります。
- トークン環境変数の命名規則（`<PREFIX>_BOT_TOKEN`, `<PREFIX>_APP_TOKEN`）がズレると、Renderデプロイ時にアプリが永久にスキップされます。

## 実行手順とゲート（順序制約）

以下のステップを **必ず順番通りに** 実行してください。前のステップが完了するまで次のステップに進んではいけません。

### Gate 1: アプリ名の検証

1. アプリ名が **ケバブケース（`^[a-z0-9-]+$`、例: `sales-notify-bot`, `ma-app-02`）** であることを確認する。
2. `apps/<app-name>/` がまだ存在しないことを確認する。

### Gate 2: CLIスクリプトによる自動生成（手動作成の禁止）

1. ゼロから手動でファイルを作成せず、必ず以下のコマンドを実行する：

   ```sh
   npm run create:app <app-name>
   ```
2. 以下の成果物（Artifact）が生成されたことを確認する：
   - `apps/<app-name>/index.js`
   - `apps/<app-name>/manifest.json`
   - `apps/<app-name>/listeners/index.js`
   - `apps/<app-name>/listeners/events/index.js`
   - `apps/<app-name>/listeners/events/app-home-opened.js`
   - `apps/<app-name>/listeners/messages/index.js`
   - `apps/<app-name>/listeners/messages/sample-message.js`
3. `.env.sample` に `<PREFIX>_BOT_TOKEN` と `<PREFIX>_APP_TOKEN` が追記されていることを確認する（`<PREFIX>` はハイフンをアンダースコアに変換した大文字、例: `SALES_NOTIFY_BOT`）。

### Gate 3: テストとリンターの実行検証

1. 生成されたアプリがローダー（`apps/index.js`）で安全にスキップ（トークン未設定時）および初期化（トークン指定時）できることを確認する。
2. 以下のコマンドを実行し、すべて **Exit Code 0** であることを確認する：

   ```sh
   npm run lint
   npm test
   ```

## 禁止される言い訳（Preempted Excuses）

- ×「簡単な構成なので `npm run create:app` を使わず手動でファイルを作成しました」
- ×「自動生成されたコードなので `npm run lint` / `npm test` の実行は省略しました」
- ×「説明のために生成後の `.js` ファイルにコメントを追加しました」（コメントは全面禁止です）
