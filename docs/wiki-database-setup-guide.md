# データベース環境構築手順（クローン後スタートアップガイド）

このドキュメントは、本リポジトリをクローンした開発メンバーが、ローカル環境（XAMPP）でデータベースを準備し、アプリを動かすまでの最短手順書です。

---

## 1. パッケージのインストール

リポジトリをクローン後、プロジェクトルートで依存関係をインストールします。

```bash
npm install
```

---

## 2. 環境変数ファイル（`.env`）の準備

サンプルファイルをコピーして `.env` を作成します。

```bash
# Windows (PowerShell)
Copy-Item .env.sample .env

# Mac / Linux (Bash)
cp .env.sample .env
```

作成された `.env` 内の `DATABASE_URL` がローカル XAMPP の設定になっていることを確認します。

```env
DATABASE_URL="mysql://root:@localhost:3306/slack_app_db"
```
※ XAMPP の root にパスワードを設定している場合は `mysql://root:<パスワード>@localhost:3306/slack_app_db` に変更してください。

---

## 3. XAMPP（MySQL）の起動とデータベース作成

1. **XAMPP Control Panel** を開き、**MySQL** の **「Start」** をクリックします。
2. ブラウザで [http://localhost/phpmyadmin](http://localhost/phpmyadmin) を開きます。
3. 左メニューの **「新規作成」** をクリックし、以下を入力して **「作成」** をクリックします：
   - **データベース名**: `slack_app_db`
   - **照合順序**: `utf8mb4_unicode_ci`

---

## 4. テーブルの反映と Prisma クライアント生成

ターミナルで以下のコマンドを実行し、データベースにテーブルを作成・同期します。

```bash
# 1. スキーマ定義を XAMPP の DB に反映
npx prisma db push

# 2. Prisma クライアントの生成
npx prisma generate
```

---

## 5. 動作確認

### 5.1 ブラウザでのデータ確認（Prisma Studio）
```bash
npx prisma studio
```
ブラウザで [http://localhost:5555](http://localhost:5555) が開き、`sample_users` テーブルが表示されれば DB 接続成功です。（確認後はターミナルで `Ctrl + C` で終了）

### 5.2 テストの実行
```bash
npm test
```
全テストが PASS することを確認します。

---

## 6. アプリの起動

```bash
npm run dev
```

---

## 【参考】本番環境（TiDB Cloud & Render）への反映手順

本番用 DB（TiDB Cloud）と Render を接続する際の手順です。

1. **TiDB Cloud で接続 URL を取得**:
   - [TiDB Cloud](https://tidbcloud.com/) で Serverless クラスター（Tokyo リージョン）を作成し、「Connect」から Prisma 用の接続 URL を取得します。
   ```text
   mysql://<ユーザー名>:<パスワード>@<ホスト名>:4000/<DB名>?sslaccept=strict
   ```

2. **本番 DB へのテーブル反映（初回のみ）**:
   ```bash
   # Windows (PowerShell)
   $env:DATABASE_URL="<TiDBの接続URL>"
   npx prisma db push

   # Mac / Linux
   DATABASE_URL="<TiDBの接続URL>" npx prisma db push
   ```

3. **Render の環境変数に設定**:
   - Render ダッシュボードの対象 Web Service > **Environment** に以下を追加して保存します。
     - **Key**: `DATABASE_URL`
     - **Value**: `<TiDBの接続URL>`
