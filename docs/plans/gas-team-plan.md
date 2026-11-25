# GAS 班（メンバー A・B）開発進め方プラン

- **対象サブシステム**: 年間行事予定インポーター（`gas/excel-calendar-importer/`）
- **参照すべき要件定義書**: [`docs/specs/gas-importer-requirements.md`](../specs/gas-importer-requirements.md)
- **採用モデル・認証方針**: `gemini-3.8-flash`（`thinkingLevel`: `minimal` / `low`）、チーム共通アカウント（`akitacore.stamina@gmail.com`）で「自分として実行」デプロイ ＋ 簡易パスコード認証（案 B）

---

## 1. メンバー別 担当ファイル分担（コンフリクト防止）

2 人が同じファイルを同時編集しないよう、以下のようにファイルを完全に分離します。

| 担当 | 担当ファイル | 担当領域 |
| :--- | :--- | :--- |
| **メンバー A** | `gas/excel-calendar-importer/index.html` | 簡易パスコード入力 UI、カレンダー選択 UI、Excel ファイル選択・クライアント側読取（SheetJS 等）、登録結果・エラー表示 UI |
| **メンバー B** | `gas/excel-calendar-importer/code.gs` | `doGet()`、パスコード検証、Gemini API（`gemini-3.8-flash`）呼び出し、複数の校内共有 Google カレンダーへの一括登録ロジック |
| **共通（変更時は相談）** | `gas/excel-calendar-importer/appsscript.json` | GAS プロジェクト設定・マニフェスト |

---

## 2. ステップ別 進め方

### Step 0：キックオフ ＆ 未確定事項（TBD）の確定（Day 1）
コードを書く前に、メンバー A・B とリーダーで以下を決め、[`docs/specs/gas-importer-requirements.md`](../specs/gas-importer-requirements.md) へ追記します。

- [ ] **対象 Excel のレイアウト前提**（先頭シートのみか複数シートか、結合セルの扱い、最大ファイルサイズ）
- [ ] **登録前プレビュー画面の有無**（AI 抽出後に画面で一覧確認・手動修正してから登録するか、直接登録するか）
- [ ] **カレンダー選択肢の管理方法**（スクリプトプロパティで管理するか、コード内の定数／画面入力にするか）
- [ ] **フロント（`index.html`）とサーバー（`code.gs`）の受け渡し JSON 形式**（関数名・引数・戻り値の合意）

### Step 1：完全モックによる一気通貫疎通（Day 1〜4）
まずは Gemini API や本番カレンダーを繋がず、**固定のダミーデータで画面〜サーバー処理〜結果表示が繋がる状態** を最速で作ります。

- **メンバー A（`index.html`）**:
  1. パスコード入力画面、カレンダー選択プルダウン、Excel ファイル選択フォーム、実行ボタンを作成する。
  2. 選択された Excel ファイルを行データ配列（または JSON）へ変換し、`google.script.run.importEvents(...)` を呼び出す処理を作る。
  3. サーバーから返ってくる結果サマリー（成功件数・失敗件数・詳細リスト）を画面に表示する。
- **メンバー B（`code.gs`）**:
  1. スクリプトプロパティ（`PropertiesService`）に保存したパスコードを照合する関数を作る。
  2. AI 抽出関数をまずは **固定ダミーの予定配列を返すモック関数**（例：`MOCK_MODE = true`）として実装し、テスト用 Google カレンダーへ 1〜2 件登録できることを確認する。
- **Day 4 ゴール**: ブラウザから架空のテスト Excel を選択 → モック予定がテスト用 Google カレンダーへ登録され、結果が画面に表示されること。

### Step 2：開発用無料枠キー ＆ 架空データでの実連携検証（Day 5〜7）
1. メンバー B が `UrlFetchApp` を使って `gemini-3.8-flash`（`thinkingLevel`: `minimal` または `low`）を呼び出す実処理を実装する（API キーは `PropertiesService.getScriptProperties()` から取得し、コードには絶対に直書きしない）。
2. **完全な架空データのみで作ったテスト用 Excel**（例：「架空体育祭」「架空始業式」等）を使い、表記揺れのある行が正しく JSON 抽出され、テスト用カレンダーへ登録されることを検証する。

> [!CAUTION]
> **開発用無料枠の API キーを使う間は、本物の学校年間行事予定 Excel や生徒・教員の実名が入ったファイルを絶対に入力しないでください。**

---

## 3. GAS 班の日々の開発・Git PR フロー

GAS はブラウザ上のエディタで動くため、以下の手順で Git リポジトリと同期します。

1. `main` を最新化し、作業ブランチを作成する：
   ```powershell
   git checkout main
   git pull
   git checkout -b feat/gas-xxxx
   ```
2. ローカルの `gas/excel-calendar-importer/` 配下（自分の担当ファイル）をエディタで編集する。
3. 編集した内容を Google Apps Script エディタ（自分のテスト用 GAS プロジェクト）へコピー＆ペーストして動作検証する。
4. 動作確認が取れたらローカルファイルをコミット＆プッシュし、GitHub で PR を作成する。
5. **ペアの相手（A ↔ B）にバディチェック** を依頼し、OK が出たらリーダーへレビュー・マージを依頼する。

（※ `gas/` 配下は `biome.json` および `npm test` の対象外に設定済みですが、PR 前に `npm test` でリポジトリ全体が壊れていないことも念のため確認してください）
