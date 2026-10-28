# Slack Bot マルチ相乗り基盤 完全ガイド（環境構築・作成・実行・Renderデプロイ）

このドキュメントは、1つの Node.js プロセス（および1つの Render サービス）上で複数の Slack Bot を安全に常時稼働させる「マルチBot相乗り基盤」の環境構築、Botアプリの作成、ローカル実行、そして Render へのデプロイ手順をまとめた GitHub Wiki 用の総合ガイドです。

---

## 目次

1. [全体アーキテクチャの概要](#1-全体アーキテクチャの概要)
2. [事前準備（前提要件）](#2-事前準備前提要件)
3. [ローカル環境構築](#3-ローカル環境構築)
4. [Slack 側でのアプリ登録とトークン発行](#4-slack-側でのアプリ登録とトークン発行)
5. [ローカルでの動かし方と動作確認](#5-ローカルでの動かし方と動作確認)
6. [新規 Bot の追加方法（自動生成 CLI）](#6-新規-bot-の追加方法自動生成-cli)
7. [Render へのデプロイ手順（常時稼働）](#7-render-へのデプロイ手順常時稼働)
8. [トラブルシューティング & FAQ](#8-トラブルシューティング--faq)

---

## 1. 全体アーキテクチャの概要

本基盤は、複数の Slack Bot を単一のクラウドサーバー（Render 無料枠等）で経済的かつ安定して運用するために設計されています。

- **障害隔離（Fault Isolation）**: 特定の Bot のトークン未設定や実行時エラーが発生しても、他の Bot やプロセス全体が停止しない安全設計。
- **動的ローダー（`apps/index.js`）**: `apps/` ディレクトリ配下に配置された各 Bot を自動走査し、並行起動。
- **HTTP ヘルスチェックサーバー内蔵**: Render の Web Service 要件およびスリープ防止に対応する軽量サーバーを内蔵。
- **CLI 自動生成（`npm run create:app`）**: 新規 Bot の雛形作成と `.env` の枠組み追加を一発で自動化。

```text
[Render / Local Node.js Process]
  │
  ├─ HTTP Server (Healthcheck on PORT 3000)
  │
  └─ apps/index.js (Dynamic Loader)
       ├─ apps/ma-app-01/ (Bot 1: Socket Mode)
       ├─ apps/custom-bot/ (Bot 2: Socket Mode)
       └─ apps/... (Bot N: Socket Mode)
```

---

## 2. 事前準備（前提要件）

以下の環境およびアカウントをあらかじめ用意してください。

- **Node.js**: `v18.0.0` 以上（推奨: v20 以上の LTS）
- **npm**: Node.js に同梱
- **Git**: コード管理・GitHub 連携用
- **Slack ワークスペース & アカウント**: 管理者権限またはアプリ追加が許可されているワークスペース
- **GitHub アカウント**: リポジトリホスティング用
- **Render アカウント**: デプロイ用（無料枠で利用可能）

---

## 3. ローカル環境構築

### 3.1 リポジトリのクローンと依存関係のインストール

ターミナルを開き、リポジトリをクローンしてパッケージをインストールします。

```bash
# リポジトリのクローン（URLは適宜変更してください）
git clone <YOUR_REPOSITORY_URL>
cd slack-extension-app

# 依存パッケージのインストール
npm install
```

### 3.2 環境変数ファイル（`.env`）の準備

サンプル設定ファイルをコピーして `.env` を作成します。

```bash
# Windows (PowerShell)
Copy-Item .env.sample .env

# Mac / Linux (Bash)
cp .env.sample .env
```

※ 初期状態ではトークンに `YOUR_*_TOKEN_HERE` などのプレースホルダーが入っています。この状態の Bot は起動時に自動で安全にスキップされます。

---

## 4. Slack 側でのアプリ登録とトークン発行

各アプリ（例: `apps/ma-app-01/`）に対応する Slack App を作成します。

### ステップ 1: Manifest からアプリを作成

1. ブラウザで [Slack API: Your Apps](https://api.slack.com/apps) にアクセスします。
2. **「Create New App」** をクリックします。
3. 作成方法の選択で **「From an app manifest」** を選びます。
4. インストール先のワークスペースを選択します。
5. **「Enter app manifest below」** の画面で **JSON** タブを選択し、リポジトリ内の `apps/ma-app-01/manifest.json` の内容をコピー＆ペーストして貼り付けます。
6. 内容を確認し、**「Create」** をクリックします。

### ステップ 2: App-Level Token（`xapp-...`）の発行

1. アプリ管理画面の左メニューから **「Basic Information」** を開きます。
2. 画面中部の **「App-Level Tokens」** セクションにある **「Generate Token and Scopes」** をクリックします。
3. トークン名（例: `socket-mode-token`）を入力し、スコープに **`connections:write`** を追加します。
4. **「Generate」** をクリックすると表示される `xapp-...` から始まるトークンをコピーして控えておきます。

### ステップ 3: ワークスペースへのインストールと Bot Token（`xoxb-...`）の取得

1. 左メニューの **「Install App」** を開きます。
2. **「Install to Workspace」** をクリックし、権限を許可します。
3. 発行された **「Bot User OAuth Token」**（`xoxb-...` から始まるトークン）をコピーして控えておきます。

### ステップ 4: `.env` へのトークン設定

控えたトークンを、プロジェクト直下の `.env` に設定します。

```env
# apps/ma-app-01 用のトークン
MA_APP_01_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
MA_APP_01_APP_TOKEN=xapp-x-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 5. ローカルでの動かし方と動作確認

### 5.1 アプリの起動

```bash
# 通常起動
npm start

# 開発用起動（ファイル変更時の自動再起動）
npm run dev
```

#### 起動ログの確認例
```text
HTTP server listening on port 3000
Loading apps from apps directory...
Found app directory: ma-app-01
Initializing app: ma-app-01
⚡️ Bolt app "ma-app-01" is running!
All configured Slack apps have started successfully!
```

トークンが設定されていないアプリがある場合、次のように安全にスキップされます：
```text
Skipping app "sample-bot": tokens are not configured.
```

### 5.2 動作確認

1. **ヘルスチェック確認**: ブラウザで `http://localhost:3000` にアクセスし、`Slack multi-bot service is running.` と表示されることを確認します。
2. **Slack 上での動作確認**:
   - Bot をパブリックチャンネルに招待（`/invite @アプリ名`）します。
   - `hello` と話しかけて返答があるか確認します。
   - アプリの「ホーム」タブを開き、ホーム画面が表示されるか確認します。

### 5.3 リントとテストの実行

開発規約や安全性を担保するため、以下のコマンドで静的解析とテストを実行できます。

```bash
# Biome による構文・フォーマット検証
npm run lint

# 単体テスト実行（node:test）
npm test
```

---

## 6. 新規 Bot の追加方法（自動生成 CLI）

新しい Bot を追加する際は、手動でフォルダやファイルをコピペする必要はありません。自動生成コマンドが用意されています。

### 6.1 生成コマンドの実行

```bash
npm run create:app <新規アプリ名>
```

例:
```bash
npm run create:app sales-support-bot
```

### 6.2 実行によって自動で行われること

1. **フォルダ・雛形の自動生成**:
   `apps/sales-support-bot/` 配下に以下が一括生成されます。
   - `index.js`: 安全な初期化関数 `initApp()`
   - `manifest.json`: Slack 登録用マニフェスト定義
   - `listeners/`: メッセージ、イベント、コマンド等のハンドラー雛形
2. **環境変数ファイルの更新**:
   `.env` および `.env.sample` の末尾に専用のトークン設定枠が自動追記されます。
   ```env
   # sales-support-bot
   SALES_SUPPORT_BOT_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
   SALES_SUPPORT_BOT_APP_TOKEN=YOUR_APP_TOKEN_HERE
   ```

### 6.3 追加後の手順

1. [セクション 4](#4-slack-側でのアプリ登録とトークン発行) の手順に従い、生成された `apps/<新規アプリ名>/manifest.json` を使って Slack 側で新規アプリを作成します。
2. 発行された `xoxb-...` と `xapp-...` を `.env` に設定します。
3. `npm start` を実行するだけで、既存の Bot と並行して即座に起動します。

---

## 7. Render へのデプロイ手順（常時稼働）

Render を使用して、24時間常時稼働する無料・低コスト環境を構築します。

### 7.1 GitHub リポジトリへのプッシュ

まずは作成したコードを GitHub にプッシュします。

> [!WARNING]
> `.env` には実際の Slack トークン（秘密情報）が記載されています。`.gitignore` に `.env` が含まれていることを確認し、**絶対に GitHub にコミット・公開しないでください**。

```bash
git add .
git commit -m "feat: setup slack multi-bot architecture"
git push origin main
```

### 7.2 Render で Web Service を作成

1. [Render ダッシュボード](https://dashboard.render.com/) にログインします。
2. 右上の **「New +」** から **「Web Service」** を選択します。
3. 連携した GitHub アカウントから対象のリポジトリを選択（**Connect**）します。
4. サービス設定画面で以下を入力・選択します：

| 設定項目 | 入力値 |
| :--- | :--- |
| **Name** | 任意（例: `slack-multi-bot-service`） |
| **Region** | `Singapore` または `Oregon`（日本から近い地域推奨） |
| **Branch** | `main` |
| **Root Directory** | 空欄（プロジェクトルート） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### 7.3 Render 側での環境変数（Environment Variables）設定

画面下部の **「Environment Variables」** セクションに、本番で動かす各 Bot のトークンを設定します。

| Key（キー） | Value（値の例） | 説明 |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | 本番環境モード |
| `PORT` | `3000` | ヘルスチェックサーバー用ポート |
| `MA_APP_01_BOT_TOKEN` | `xoxb-...` | アプリ1の Bot トークン |
| `MA_APP_01_APP_TOKEN` | `xapp-...` | アプリ1の App レベルトークン |
| `SALES_SUPPORT_BOT_BOT_TOKEN` | `xoxb-...` | （追加アプリがある場合）Bot トークン |
| `SALES_SUPPORT_BOT_APP_TOKEN` | `xapp-...` | （追加アプリがある場合）App トークン |

### 7.4 デプロイの実行と確認

1. **「Deploy Web Service」** をクリックします。
2. ビルドと起動ログがリアルタイムに表示されます。
3. ログに以下が出力され、ステータスが **Live** になればデプロイ成功です：
   ```text
   HTTP server listening on port 3000
   ⚡️ Bolt app "ma-app-01" is running!
   All configured Slack apps have started successfully!
   ```

### 7.5 Render 無料枠のスリープ対策（常時稼働化）

Render の Free プランは、15分間外部からの HTTP アクセスがないと自動的に休止状態（スリープ）に入ります。
本プロジェクトにはポート 3000 で応答する HTTP サーバーが最初から組み込まれているため、外部の死活監視サービスから定期アクセスすることで常時稼働を維持できます。

1. Render のダッシュボードから、作成した Web Service の公開 URL（例: `https://slack-multi-bot-service.onrender.com`）をコピーします。
2. 無料の外部監視サービス（例: [cron-job.org](https://cron-job.org/) または [UptimeRobot](https://uptimerobot.com/)）に登録します。
3. **HTTP GET** の監視対象 URL として上記 Render の URL を登録し、**10分間隔** でリクエストを送信するよう設定します。
4. これによりサーバーのスリープが防止され、Slack Bot が常に即座に応答できるようになります。

---

## 8. トラブルシューティング & FAQ

### Q1. 起動時に `Skipping app "...": tokens are not configured.` と表示されて動かない
- **原因**: `.env` または Render の環境変数名が間違っているか、値が空、もしくは `YOUR_*` のままになっています。
- **解決策**: 環境変数名が `<APP_NAME_UPPER>_BOT_TOKEN` および `<APP_NAME_UPPER>_APP_TOKEN` と完全に一致しているか、前後に余分なスペースが入っていないか確認してください。

### Q2. Slack 側で「operation_timeout（3秒ルール）」や「Dispatch failed」エラーが出る
- **原因**: スラッシュコマンド（`commands`）、ショートカット（`shortcuts`）、ボタン操作（`actions`）、モーダル送信（`views`）では、Slack API の仕様として **3秒以内に `await ack()` を呼ぶ必要があります**。
- **解決策**: 各リスナー関数の先頭で最初に `await ack();` を呼び出しているか確認してください。

### Q3. 特定の Bot のコードが原因でサーバー全体がクラッシュした
- **原因**: リスナー関数内で `try...catch` のない非同期エラー（未処理の例外）がスローされ、Node.js プロセスが終了してしまった可能性があります。
- **解決策**: リスナー内の処理は必ず全体を `try { ... } catch (error) { logger.error(error); }` で囲み、エラーを個別に握り潰してロギングする設計を遵守してください。

### Q4. Render へのデプロイ後にコード修正を反映させるには？
- GitHub の `main` ブランチに修正内容を `git push` すれば、Render が自動で変更を検知して再ビルド・再デプロイ（Auto-Deploy）を行います。

