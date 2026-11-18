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
- トークン・OAuth環境変数の命名規則（`<PREFIX>_CLIENT_ID`, `<PREFIX>_BOT_TOKEN` 等）がズレると、Renderデプロイ時やローカル開発時にアプリがスキップされます。

## 実行手順とゲート（順序制約）

以下のステップを **必ず順番通りに** 実行してください。前のステップが完了するまで次のステップに進んではいけません。

### Gate 1: アプリ名の検証

1. アプリ名が **ケバブケース（`^[a-z0-9-]+$`、例: `message-calendar-bot`, `sales-notify-bot`）** であることを確認する。
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
3. `.env.sample` に `<PREFIX>_BOT_TOKEN` と `<PREFIX>_APP_TOKEN` が追記されていることを確認する（`<PREFIX>` はハイフンをアンダースコアに変換した大文字）。
4. **OAuth 本番配布モード（レベル1）にも対応させる場合**:
   - `apps/<app-name>/index.js` で `lib/slack-app-factory.js` の `createMultiModeSlackApp` を使用する。
   - GUI 設定ダッシュボードが必要な場合は、`listeners/index.js` で `lib/slack-setup-ui.js` の `registerSetupUiListeners` を登録する。
   - `.env.sample` に `<PREFIX>_CLIENT_ID`, `<PREFIX>_CLIENT_SECRET`, `<PREFIX>_SIGNING_SECRET`, `<PREFIX>_STATE_SECRET` のプレースホルダーを追記する。

### Gate 3: テストとリンターの実行検証

1. 生成されたアプリがローダー（`apps/index.js`）で安全にスキップ（トークン未設定時）および初期化（トークン指定時）できることを確認する。
2. 以下のコマンドを実行し、対象ファイルにエラーがなく、単体テストがすべて PASS することを確認する：

   ```sh
   npm run lint
   npm test
   ```

## 禁止される言い訳（Preempted Excuses）

- ×「簡単な構成なので `npm run create:app` を使わず手動でファイルを作成しました」
- ×「自動生成されたコードなので `npm run lint` / `npm test` の実行は省略しました」
- ×「コードを見ればわかると思い、カスタマイズ後の `.js` ファイルの説明コメントを省略しました」（初学者に配慮し、処理の意図や責務のコメントを必ず記述してください）
