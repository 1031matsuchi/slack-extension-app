# 設計仕様書群（docs/specs/）

このディレクトリでは、システム全体の要件定義書・設計書・アーキテクチャ図および個別仕様書を管理します。

---

## 1. ドキュメント構成と読む順序

| 文書 | 役割 | 主な読者 |
| :--- | :--- | :--- |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | プロジェクト全体の目的（Why）・実現すること（What）・スコープ・非機能要件 | 全員（最初に読む文書） |
| [`gas-importer-requirements.md`](gas-importer-requirements.md) | 年間行事予定インポーター（GAS Web アプリ）の個別要件定義書 | GAS 班・リーダー |
| [`message-calendar-bot-requirements.md`](message-calendar-bot-requirements.md) | Slack 予定登録 Bot（`message-calendar-bot`）の個別要件定義書 | Bot 班・リーダー |
| [`BASIC_DESIGN.md`](BASIC_DESIGN.md) | システム全体像・技術スタック・不変条件・レイヤ責務・外部連携 API 叩き台・開発プロセス | 開発メンバー / レビュアー |
| [`DETAIL_DESIGN.md`](DETAIL_DESIGN.md) | ディレクトリ構成・主要 I/F・環境変数・DB スキーマ・シーケンス図（軽量・ハイブリッド型） | 開発メンバー / レビュアー |
| [`diagrams/architecture.drawio`](diagrams/architecture.drawio) | システム全体アーキテクチャ図（Draw.io） | 全員 |
| [`TEMPLATE.md`](TEMPLATE.md) | 新機能追加時の個別仕様書（`SPEC-NNNN-<slug>.md`）作成テンプレート | 機能開発担当者 |
| [`reference/`](reference/README.md) | 仕様化前の外部参照資料・元資料置き場 | 機能開発担当者 |

---

## 2. 機能追加・変更時の標準ステップ

1. **要件整理**: 個別要件定義書または `SPEC-NNNN-<slug>.md`（[`TEMPLATE.md`](TEMPLATE.md) 使用）に目的・スコープ・受け入れ条件（AC）を定義する。
2. **設計判断の記録**: 後戻りしにくい選択（外部サービス選定、トリガー方式、DB スキーマ方針など）を行った場合は [`private/docs/adr/`](../../private/docs/adr/README.md) に ADR を作成する。
3. **実装・テスト**: レイヤ責務（[`BASIC_DESIGN.md`](BASIC_DESIGN.md) 第4章）と該当スキル（`create-slack-app` / `add-slack-listener` / `code-review-and-qa`）の手順に従って実装・テストを行う。
4. **仕様書の同期**: 全体構成・環境変数・データモデルに変更がある場合は、`BASIC_DESIGN.md` / `DETAIL_DESIGN.md` も**同一 PR で**更新する。
