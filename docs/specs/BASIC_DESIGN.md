# 全体基本設計書（BASIC DESIGN）

## 1. 目的と位置づけ

本書は、学内予定管理・通知連携システム（`slack-extension-app`）の **システム全体構成、採用技術、レイヤ責務と依存ルール、中核ルール（不変条件）、外部連携仕様の叩き台、および開発・運用プロセス** を定義します。
実装詳細（DB スキーマ・環境変数・シーケンス図）は [`DETAIL_DESIGN.md`](DETAIL_DESIGN.md)、コーディング規約の正本は [`AGENTS.md`](../../AGENTS.md) を参照してください。

---

## 2. システム全体像と技術スタック

### 2.1 システム全体構成（モノレポ・3サブシステム）
1つの Node.js プロセス（Render Free 1インスタンス）上で複数の Slack Bot を相乗り稼働させつつ、年間行事予定インポーター（GAS Web アプリ）を同一リポジトリ（`gas/excel-calendar-importer/`）で管理するモノレポ構成です。

- システム全体アーキテクチャ図: [`diagrams/architecture.drawio`](diagrams/architecture.drawio)

### 2.2 技術スタック

| 項目 | 採用技術・方針 | 備考 |
| :--- | :--- | :--- |
| **言語・実行環境** | Node.js 18+（ES Modules） / GAS（V8 ランタイム） | Node.js 側は `require` 禁止・相対パス `.js` 必須 |
| **Slack フレームワーク** | `@slack/bolt` v5 | 本番: `HTTPReceiver`（OAuth 2.0 Direct Install） / 開発: Socket Mode 両対応 |
| **データベース** | MySQL 互換（ローカル: XAMPP / 本番: TiDB Cloud Serverless） | 接続先は `DATABASE_URL` で切替 |
| **ORM / 変更管理** | Prisma 7（`@prisma/client` + `@prisma/adapter-mariadb`） | `prisma7.config.ts` を使用し、必ず **Prisma Migrate** で管理 |
| **AI モデル** | Google Gemini API（`@google/genai` / GAS `UrlFetchApp`） | GAS: `gemini-3.8-flash` / Bot: `gemini-3.5-flash-lite`（`MOCK_GEMINI=true` 切替予定） |
| **Google カレンダー** | Google Calendar API v3（案A: サービスアカウント共有方式） | チーム共通 Google アカウント（`akitacore.stamina@gmail.com`）で管理 |
| **ホスティング / 定期実行** | Render（Web Service Free） / `cron-job.org` | 死活監視（`GET /health`）＆ 定期通知（`POST /cron/remind`） |
| **テスト / Linter** | `node:test`, `node:assert` / Biome | `gas/` 配下は Node.js 側の Lint / Test から除外 |

---

## 3. 中核ルール（不変条件）

以下はどの機能追加・改修でも破ってはならないルールです。

| 不変条件 | 内容 |
| :--- | :--- |
| **障害隔離（Fault Isolation）** | 1つの Bot・1つのワークスペース・1つの外部 API の認証失敗・タイムアウト・例外が、他の Bot やプロセス全体を停止させないこと |
| **安全なスキップ** | 環境変数が未設定・空文字・`YOUR_*` プレースホルダーの Bot は、例外を投げずに `initApp` が `null` を返してスキップされること |
| **GUI ファースト** | ユーザー設定・操作にスラッシュコマンドを使わず、App Home・モーダル・ボタン・プルダウン（`lib/slack-setup-ui.js`）とインストール直後 DM に統一すること |
| **3秒以内の応答** | `actions` / `shortcuts` / `views` のリスナーは、処理の最初に `await ack()` を呼ぶこと |
| **二重実行の防止** | 開発時 Socket Mode では同一 Bot トークンを複数人で同時に使わないこと（各自専用の個人テスト用 Slack App を使用） |
| **秘密情報・実データの保護** | 実トークン（`xoxb-` / `xapp-`）・API キー・Google 秘密鍵をコミット／ログ出力しないこと。**開発用無料枠の Gemini API キーへ実データを入力しないこと** |
| **テストでの外部通信禁止** | テスト時（`NODE_ENV === 'test'`）は `tokenVerificationEnabled: false` とし、Slack API・外部 API へ実通信しないこと |

---

## 4. レイヤ責務と依存ルール

マルチ Bot 相乗り基盤における越境（リスナーへの業務ロジック集中、Bot 間の相互依存等）を防ぐため、以下の責務境界を守ります。

| レイヤ | 該当ファイル | 役割（やること） | 禁止事項（やらないこと） |
| :--- | :--- | :--- | :--- |
| **オーケストレーター** | `app.js` | 環境変数読込、統合 HTTP サーバー（ヘルスチェック・Cron・`/slack/<appName>/*` 動的ルーティング）、Socket Mode Bot 並行起動 | Bot 固有の処理・import、1つの Bot の失敗で `Promise.all` 全体を reject させる書き方、`process.exit()` |
| **ローダー** | `apps/index.js` | `apps/` 直下の走査、`initApp` 呼び出し、Bot ごとの例外捕捉とスキップ | 特定 Bot 名による分岐、Bot のリスナー登録 |
| **Bot 初期化** | `apps/<app-name>/index.js` | `createMultiModeSlackApp` を用いた OAuth / Socket Mode 両対応の初期化 | トークン不備時の例外送出、外部 API 通信、他 Bot の import |
| **リスナー** | `apps/<app-name>/listeners/**` | `await ack()`、入口での `teamId` → `workspaceId` 変換、サービス呼び出し、Slack 返信、`try...catch` + `logger.error` | 外部 API SDK の直接操作、複雑な変換ロジック、生 SQL |
| **サービス** | `apps/<app-name>/services/**` | 業務ロジック、外部 API 連携、DB アクセス | Slack の `ack` / `say` / `client` への依存、各所での `process.env` 乱立 |
| **共通ライブラリ** | `lib/**` | 全 Bot 共有の基盤（Prisma、OAuth ストア、初期化ファクトリ、GUI セットアップ、Google Calendar、Gemini I/F） | 特定 Bot 固有の業務ロジック、外部 Bot への逆依存 |
| **HTTP ルート** | `routes/**` | Cron 等の HTTP 専用エンドポイント処理（シークレット検証含む） | 長時間処理の無制限待機 |
| **GAS サブシステム** | `gas/excel-calendar-importer/**` | 独立した GAS Web アプリコード（Excel 解析・一括登録） | Node.js 側（`apps/`, `lib/`）とのファイル相互参照 |

### 依存方向のルール
- `app.js` → `apps/index.js` →（動的 import）→ `apps/<app-name>/index.js`
- リスナー → 同一 Bot のサービス / `lib/`（サービスからリスナーや Slack `client` への逆依存は禁止）
- **`apps/<A>/` ↔ `apps/<B>/` の相互依存は禁止**（共通化したい処理は `lib/` へ移す）

---

## 5. 【レビュー用叩き台】外部アプリ連携（Pull 型）共通インターフェース案

`apps/calendar-reminder-bot/` に相乗りさせる「学生開発の外部アプリ連携通知機能」について、詳細実装に入る前のレビュー用叩き台を定義します（※最終スキーマは TBD）。

### 5.1 連携先エンドポイント管理（環境変数ホワイトリスト案）
GUI 登録は行わず、管理者がサーバー環境変数 `EXTERNAL_NOTIFY_SOURCES`（JSON 配列形式）で巡回対象を管理する案です。

```json
[
  {
    "sourceId": "club-notice-app",
    "name": "部活お知らせアプリ",
    "url": "https://example-student-app.onrender.com/api/notifications",
    "workspaceId": "T01234567"
  }
]
```
- **未設定時**: 環境変数が空または未設定の場合はエラーとせず、外部連携巡回を安全にスキップする。
- **タイムアウト制御**: 1つの外部 API への `GET` リクエストには `AbortController` 等で **5 秒タイムアウト** を設定し、遅延・エラー時は該当アプリのみスキップして他アプリおよびカレンダーリマインドを継続する。

### 5.2 外部アプリ API（`GET`）共通 JSON レスポンス仕様案
他学生が開発する外部アプリは、以下の形式で通知対象データ（最新件数上限あり、例：最大 10 件/回）を返す規約とします。

```json
{
  "items": [
    {
      "id": "notice-2026-1124-001",
      "title": "【連絡】明日の実験室利用について",
      "body": "15:00〜17:00はメンテナンスのため利用できません。",
      "url": "https://example-student-app.onrender.com/notices/1",
      "publishedAt": "2026-11-24T08:00:00+09:00"
    }
  ]
}
```
- **`id`（必須・文字列）**: 重複通知防止のための一意な識別子。`sourceId` + `id`（および `workspaceId`）の組み合わせを DB に記録し、未通知の項目のみ Slack の通知先チャンネルへ投稿する。

---

## 6. 開発・デプロイ・障害対応プロセス

### 6.1 開発プロセス（5名体制・GitHub Flow）
1. 担当領域（リーダー / GAS 班 A・B / Bot 班 C・D）ごとに機能ブランチを作成し、`main` へ直接 push しない。
2. 変更時は対象仕様書（`docs/specs/`）・`manifest.json`・単体テスト（正常系・異常系）を同一 PR で更新する。
3. ペア内のバディチェック後、完了ゲート（`npm run lint` / `npm test`）通過を確認してリーダーへレビュー依頼する。

### 6.2 デプロイ・障害対応（チームリーダー）
- `main` マージ後、Render へデプロイされる。新規環境変数追加時は事前に Render の Environment へ登録する。
- 障害発生時は起動ログ（`Skipping app` / `Failed to start app`）とヘルスチェック（`GET /health`）を確認し、問題のある Bot や外部連携ソースの環境変数を一時的に外すことで他機能を止めずに切り分ける。
