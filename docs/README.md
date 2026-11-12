# ドキュメント索引（docs/）

このディレクトリ（`docs/`）は、チーム全体が参照する**設計仕様書・開発ガイドライン・セットアップ手順（Wiki原稿）**を格納します。
個人の作業メモ・日報・PR下書き、および意思決定の経緯（ADR）は [`private/docs/`](../private/docs/README.md) で役割を分けて管理します。

> [!NOTE]
> AIエージェント・開発ツール共通のルールの正本（Single Source of Truth）は、ルートの [`AGENTS.md`](../AGENTS.md) です。
> 本ディレクトリの文書は AGENTS.md のルールを**設計の観点から補足**するものであり、ルールを重複・上書きしません。

---

## ディレクトリ構成

| パス | 用途 | Git管理 |
| :--- | :--- | :--- |
| [`docs/specs/`](specs/README.md) | システム全体の設計書（基本設計・詳細設計・プロセス設計・レイヤ責務）および機能別仕様書（`SPEC-NNNN`） | 管理する |
| [`docs/guidelines/`](guidelines/README.md) | チーム共通の開発ガイドライン（PR分割ガイド等） | 管理する |
| `docs/wiki-*.md` | GitHub Wiki に掲載するセットアップ・実装手順の原稿 | 管理しない（Wikiが正本） |

## 新規参加者が読む順序

1. [`wiki-setup-and-deployment-guide.md`](wiki-setup-and-deployment-guide.md) — 環境構築とBotの起動
2. [`wiki-database-setup-guide.md`](wiki-database-setup-guide.md) — ローカルDB（XAMPP / Prisma）の準備
3. [`specs/COMPONENT_SPEC.md`](specs/COMPONENT_SPEC.md) — システム全体像（設計書群の入口）
4. [`../AGENTS.md`](../AGENTS.md) — コーディング規約と完了ゲート

## 関連リンク

- AIエージェント共通指示書: [`AGENTS.md`](../AGENTS.md)（`CLAUDE.md` / `GEMINI.md` はこのファイルを読み込むだけのエントリ）
- タスク別スキル: [`.agents/skills/`](../.agents/skills/)（`.claude/skills/` に同一内容を配置）
- 開発日報・ADR: [`private/docs/README.md`](../private/docs/README.md)

