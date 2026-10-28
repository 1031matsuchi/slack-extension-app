---
name: add-slack-listener
description: >-
  Slack Botにイベント、メッセージ、スラッシュコマンド、アクション、ショートカット、モーダル（ビュー）のリスナーを追加・変更する際に使用するスキル。
  リスナー実装、manifest.jsonの同期、単体テスト作成を一貫して行う際に起動する。
---

# Slack リスナー実装・テスト追加スキル (`add-slack-listener`)

対象の `apps/<app-name>/` に新しいSlack機能を実装する際の必須手順と品質ゲートを定義します。

## 失敗コストの認識（なぜ手順を厳守するか）

1. **相乗りプロセスの全停止リスク**: リスナーコールバック内で未捕捉の例外がスローされると、同一プロセス上で稼働している他のすべてのSlack Botを巻き込んでクラッシュする危険があります。
2. **Slack 3秒タイムアウト**: `commands`, `actions`, `shortcuts`, `views` で `await ack()` を冒頭で呼ばないと、Slackクライアント上でエラー表示になります。
3. **Manifestとの不整合**: コードだけ書いて `manifest.json` のスコープ（`bot` scopes）やイベント購読（`bot_events`）、コマンド定義を更新しないと、本番環境でイベントが一切届きません。

## 実行手順とゲート（順序制約）

### Gate 1: 対象アプリと Manifest の設計確認

1. 変更対象のアプリ（例: `apps/ma-app-01/`）を特定する。
2. 追加する機能に応じて `apps/<app-name>/manifest.json` に必要な定義を特定・更新する：
   - `events`: `settings.event_subscriptions.bot_events` および必要な `oauth_config.scopes.bot`
   - `messages`: `channels:history` / `groups:history` / `im:history` 等と `chat:write`
   - `commands`: `features.slash_commands` と `commands` スコープ
   - `shortcuts`: `features.shortcuts` と `commands` スコープ
   - `actions` / `views`: `settings.interactivity.is_enabled: true`

### Gate 2: リスナーコールバックの実装（強制フォーマット）

1. ファイル名は必ず **ケバブケース**（例: `apps/<app-name>/listeners/commands/create-ticket.js`）とする。
2. **初心者にも理解しやすいコード内コメントの記述**: 関数の役割、引数や戻り値、なぜその処理が必要なのか（例: 3秒以内の `ack()` 実行、相乗り環境でのエラー隔離・ロギングなど）を初学者が理解できるよう、JSDocや説明コメント（`//`）を丁寧に記述する。
3. コールバック関数は単体テストから直接インポートできるよう **名前付きエクスポート（Named Export）** する。
4. 関数本体は必ず全体を `try ... catch (error)` で囲み、`catch` ブロック内で `logger.error(error)` を呼び出す。
5. `commands`, `actions`, `shortcuts`, `views` の場合は、`try` ブロックの最初で `await ack()` を実行する。

### Gate 3: リスナーの登録（二重記帳チェック）

1. カテゴリ別の `listeners/<category>/index.js` にコールバックをインポートし、`register(app)` 内で登録する。
2. 新しいカテゴリディレクトリを作成した場合は、`apps/<app-name>/listeners/index.js` の `registerListeners(app)` にも登録を追加する。

### Gate 4: 単体テストの必須作成（成果物の強制関数）

1. `tests/` 配下に対応するテストファイル（`*.spec.js`、ケバブケース）を作成または更新する。
2. `node:test`（`describe`, `it`, `beforeEach`, `mock`）と `node:assert` を使用し、以下の **2ケース以上** を必ず実装する：
   - **正常系テスト**: 期待されるAPI呼び出し（`ack`, `say`, `respond`, `client.views.publish` 等）が正しい引数で呼ばれること。
   - **異常系テスト**: API呼び出しが例外をスローした際、クラッシュせずに `logger.error` が呼ばれること。

### Gate 5: 機械的検証ゲート

以下のコマンドを実行し、エラー0・失敗0であることを確認する：
```sh
npm run lint
npm test
```

## 二重記帳チェックリスト（完了前セルフ監査）

| 確認項目         | チェック対象                                                      | 合格基準                                                    |
| :--------------- | :---------------------------------------------------------------- | :---------------------------------------------------------- |
| コールバック実装 | `apps/<app>/listeners/<category>/<name>.js`                       | `try...catch` と `logger.error` があり、処理意図を説明する丁寧なコメントが記載されている |
| リスナー登録     | `apps/<app>/listeners/<category>/index.js` & `listeners/index.js` | `registerListeners` から到達可能である                      |
| Manifest同期     | `apps/<app>/manifest.json`                                        | 必要なスコープ・イベント・コマンドが記載されている          |
| 単体テスト       | `tests/**/<name>.spec.js`                                         | 正常系と異常系（例外発生時）の両方がテストされている        |

## 禁止される言い訳（Preempted Excuses）

- ×「正常系のテストだけ書いて異常系（`logger.error`）のテストは省略しました」
- ×「コードを見ればわかると思いコメントを省略しました」（初学者が理解できるよう、処理意図や理由のコメントを必ず記載してください）
- ×「リスナー関数は作ったので `manifest.json` の更新はユーザーに任せます」
