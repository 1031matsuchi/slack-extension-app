# レイヤ責務補足仕様

## 1. 目的

本書は、マルチ Bot 相乗り基盤を構成する各レイヤの責務境界と依存ルールを定め、実装時の越境（リスナーへの業務ロジック集中、Bot 間の相互依存、基盤コードへの Bot 固有処理の混入など）を防ぐための仕様です。
コーディング規約の正本は [`AGENTS.md`](../../AGENTS.md)、リスナー実装手順の正本は [`add-slack-listener`](../../.agents/skills/add-slack-listener/SKILL.md) です。

---

## 2. レイヤ別の役割と禁止事項

| レイヤ | 該当ファイル | 役割（やること） | 禁止事項（やらないこと） |
| :--- | :--- | :--- | :--- |
| **オーケストレーター** | `app.js` | 環境変数読み込み、ヘルスチェックサーバー起動、全 Bot の並行起動と起動失敗の個別ログ | Bot 固有の処理・import、1つの Bot の失敗で `Promise.all` 全体を reject させる書き方、`process.exit()` |
| **ローダー** | `apps/index.js` | `apps/` 直下の走査、`initApp` の呼び出し、Bot ごとの例外捕捉とスキップ | 特定 Bot 名による分岐、Bot のリスナー登録 |
| **Bot 初期化** | `apps/<app-name>/index.js` | トークン検証、`App` 生成、`registerListeners(app)` 呼び出し | トークン不備時の例外送出、外部API通信、他 Bot の import |
| **リスナー** | `apps/<app-name>/listeners/**` | `ack()`、ペイロードからの入力取り出し、サービス呼び出し、Slack への返信（`say` / `respond` / `client.chat.postMessage` 等）、`try...catch` とログ | 外部API SDK の直接操作、複雑な変換・計算ロジック、生SQL |
| **サービス** | `apps/<app-name>/services/**` | 外部API連携（LLM・Google API 等）、業務ロジック、DBアクセス（`lib/prisma.js` 経由） | Slack の `ack` / `say` / `client` への依存、`process.env` の各所での直接参照の乱立（関数の入口でまとめて受け取る） |
| **共通ライブラリ** | `lib/**` | 全 Bot で共有するクライアント（PrismaClient 等）の生成と、未設定時の安全な `null` 返却 | 特定 Bot の業務ロジック、Slack への依存 |
| **雛形生成** | `scripts/create-app.js` | 新規 Bot ディレクトリ・`.env` 枠の生成 | 既存 Bot の上書き |

---

## 3. 依存方向のルール

| From → To | 可否 | 備考 |
| :--- | :---: | :--- |
| `app.js` → `apps/index.js` | ⭕ | 唯一の接続点 |
| `apps/index.js` → `apps/<app-name>/index.js` | ⭕ | 動的 import のみ（静的 import 禁止） |
| リスナー → 同一 Bot のサービス | ⭕ | 推奨 |
| サービス → `lib/` | ⭕ | DBクライアント等の共有 |
| リスナー → `lib/` | ⭕ | 単純な参照のみ可。複数ステップの処理はサービスへ |
| `apps/<A>/` → `apps/<B>/` | ❌ | Bot 間の相互依存は禁止。共通化したい処理は `lib/` へ移す |
| サービス → リスナー / Slack `client` | ❌ | Slack への返信はリスナーで行う。サービスは結果を値で返す |
| `lib/` → `apps/` | ❌ | 逆方向依存は禁止 |
| `app.js` / `apps/index.js` → 特定 Bot | ❌ | 基盤は Bot 名を知らない |

---

## 4. PR提出前のアーキテクチャ自己点検リスト

1. リスナーの1関数が肥大化（目安40行超）していないか。外部API呼び出しや変換処理はサービスへ分離したか。
2. すべてのリスナー・サービス呼び出し元が `try...catch` で保護され、`logger.error` でログを残しているか。
3. `commands` / `actions` / `shortcuts` / `views` で、`try` の最初に `await ack()` を呼んでいるか。
4. 他の Bot のディレクトリを import していないか。基盤コード（`app.js` / `apps/index.js`）に Bot 固有の処理を追加していないか。
5. 新しい環境変数を `.env.sample` にプレースホルダー（`YOUR_*`）で追記し、未設定時に機能が安全に無効化されるか。
6. `manifest.json` のスコープ・購読イベント・コマンド定義とコードが一致しているか。
7. Slack 入力をプロンプト・DBクエリに渡す前に検証しているか。生SQLの文字列連結をしていないか。
8. 外部APIをモックした正常系・異常系テストを追加し、`npm run lint` と `npm test` が通過しているか。

