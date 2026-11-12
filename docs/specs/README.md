# 設計仕様書群（docs/specs/）

このディレクトリでは、システム全体の固定設計書と、機能追加・改修ごとの個別仕様書（`SPEC-NNNN`）を管理します。

---

## 1. ドキュメント構成と読む順序

| 文書 | 役割 | 主な読者 |
| :--- | :--- | :--- |
| [`COMPONENT_SPEC.md`](COMPONENT_SPEC.md) | 設計書群の入口・システム全体の俯瞰・技術スタック | 全員（最初に読む文書） |
| [`BASIC_DESIGN.md`](BASIC_DESIGN.md) | 目的、利用者、中核ルール（不変条件）、非機能要件、トレードオフ方針 | チームリーダー / 新規参加者 |
| [`DETAIL_DESIGN.md`](DETAIL_DESIGN.md) | ディレクトリ構成、主要モジュール、環境変数、データモデル、変更時の更新対象 | 開発メンバー / レビュアー |
| [`LIBRARY_ARCHITECTURE_SPEC.md`](LIBRARY_ARCHITECTURE_SPEC.md) | 各レイヤ（オーケストレーター / ローダー / Bot / リスナー / サービス / 共通ライブラリ）の責務境界と依存ルール | 開発メンバー / レビュアー |
| [`PROCESS_DESIGN.md`](PROCESS_DESIGN.md) | Slackイベント処理フロー、開発・検証・変更管理・障害対応プロセス | 開発メンバー / チームリーダー |
| [`TEMPLATE.md`](TEMPLATE.md) | 機能別仕様書（`SPEC-NNNN-<slug>.md`）の作成テンプレート | 機能開発担当者 |
| [`reference/`](reference/README.md) | 仕様化前の外部参照資料・元資料置き場 | 機能開発担当者 |

---

## 2. 機能追加・変更時の標準ステップ

1. **要件整理**: [`TEMPLATE.md`](TEMPLATE.md) をコピーして `SPEC-NNNN-<slug>.md` を作成し、対象Bot・目的・スコープ・受け入れ条件（AC）を定義する。
   - 例: `SPEC-0001-ai-calendar-registration.md`
   - 番号は既存の最大番号 + 1 を4桁ゼロ埋めで採番する。
2. **設計判断の記録**: 複数案から後戻りしにくい選択（外部サービス選定、トリガー方式、DBスキーマ方針など）を行った場合は [`private/docs/adr/`](../../private/docs/adr/README.md) に ADR を作成する。
3. **実装・テスト**: レイヤ責務（[`LIBRARY_ARCHITECTURE_SPEC.md`](LIBRARY_ARCHITECTURE_SPEC.md)）と、該当スキル（`create-slack-app` / `add-slack-listener` / `code-review-and-qa`）の手順に従って実装・テストを行う。
4. **仕様書の同期**: 全体構成・環境変数・データモデルに恒久的な変更がある場合は、`BASIC_DESIGN.md` / `DETAIL_DESIGN.md` / `PROCESS_DESIGN.md` も**同一PRで**更新する。

