# データベース環境構築手順（ローカル XAMPP & Prisma）

このドキュメントは、本リポジトリの初期セットアップ（依存パッケージのインストールや `.env` の作成）を完了した開発メンバーが、ローカル環境（XAMPP）でデータベースを準備・同期し、接続確認を行うための手順書です。

> [!NOTE]
> 初めてリポジトリに参加した方は、まず先に [Slack Bot マルチ相乗り基盤 完全ガイド (wiki-setup-and-deployment-guide.md)](./wiki-setup-and-deployment-guide.md) を参照し、リポジトリのクローン、`npm install`、および `.env` ファイルの作成を完了させてから本手順に進んでください。

---

## 目次

1. [環境変数（`.env`）の DATABASE_URL 確認](#1-環境変数envの-database_url-確認)
2. [XAMPP（MySQL）の起動とデータベース作成](#2-xamppmysqlの起動とデータベース作成)
3. [テーブルの反映と Prisma クライアント生成](#3-テーブルの反映と-prisma-クライアント生成)
4. [データベース接続の動作確認](#4-データベース接続の動作確認)
- [【参考】本番環境（TiDB Cloud & Render）への反映手順](#参考本番環境tidb-cloud--renderへの反映手順)

---

## 1. 環境変数（`.env`）の DATABASE_URL 確認

セットアップガイドの手順ですでに作成済みの `.env` を開き、`DATABASE_URL` がローカル XAMPP の設定になっていることを確認します。

```env
DATABASE_URL="mysql://root:@localhost:3306/slack_app_db"
```

※ XAMPP の MySQL `root` ユーザーにパスワードを設定している場合は、`mysql://root:<パスワード>@localhost:3306/slack_app_db` に変更してください。

---

## 2. XAMPP（MySQL）の起動とデータベース作成

1. **XAMPP Control Panel** を開き、**MySQL** の **「Start」** をクリックして起動します。
2. ブラウザで [http://localhost/phpmyadmin](http://localhost/phpmyadmin) を開きます。
3. 左メニュー上部の **「新規作成」**（または「Databases」タブ）をクリックし、以下を入力して **「作成」** をクリックします：
   - **データベース名**: `slack_app_db`
   - **照合順序**: `utf8mb4_unicode_ci`

---

## 3. テーブルの反映と Prisma クライアント生成

ターミナルを開き、以下のコマンドを順に実行してデータベースにテーブルを作成・同期します。

```bash
# 1. スキーマ定義（prisma/schema.prisma）を XAMPP の DB に反映
npx prisma db push

# 2. Prisma クライアントの生成
npx prisma generate
```

---

## 4. データベース接続の動作確認

### 4.1 ブラウザでのデータ確認（Prisma Studio）

Prisma Studio を起動して、作成されたテーブルをブラウザで確認します。

```bash
npx prisma studio
```

ブラウザで [http://localhost:5555](http://localhost:5555) が開き、`sample_users` などのテーブルが表示されれば DB 接続成功です。（確認後はターミナルで `Ctrl + C` を押して終了してください）

### 4.2 DB 連携を含む単体テストの実行

```bash
npm test
```

Prisma クライアント連携を含む全テストが PASS することを確認します。

---

## 【参考】本番環境（TiDB Cloud & Render）への反映手順

> [!NOTE]
> 本番環境への DB 構築および環境変数の設定は、**チームリーダー（管理者）のみ**が実施します。一般メンバーはローカル環境（ステップ 4 まで）で開発を進めてください。

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
