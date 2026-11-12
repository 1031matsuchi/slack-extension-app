# Architecture Decision Records (ADR)

このディレクトリでは、プロジェクトにおける重要な設計判断・技術選定・規約変更の背景と理由を ADR（Architecture Decision Record）として記録します。

---

## 1. ADRを起票すべきタイミング

- 複数の実装方式・外部サービス・ライブラリの選択肢があり、トレードオフを比較して決定したとき
  - 例: AI 機能のトリガー方式（スタンプ / メンション / 常時監視）の選択、LLM・カレンダーサービスの選定
- `AGENTS.md` のルールや基盤構造（`app.js` / `apps/index.js` / `lib/`）に例外を設ける、またはルール自体を変更するとき
- DBスキーマ方針、本番環境（Render / TiDB Cloud）の構成など、後から変更するコストが高い設計を決めたとき
- コードレビューで繰り返された議論・合意事項をチームの標準ルールへ昇格させるとき
- 障害が発生し、原因と再発防止策を記録するとき

---

## 2. 命名規則と運用

- ファイル名: `ADR-NNNN-<kebab-case-slug>.md`（例: `ADR-0001-reaction-trigger-for-ai-calendar.md`）
- 番号は既存の最大番号 + 1 を4桁ゼロ埋めで採番します。
- テンプレート: [`TEMPLATE.md`](TEMPLATE.md)
- 決定を覆す場合は既存 ADR を書き換えず、新しい ADR を作成して旧 ADR のステータスを `Superseded by ADR-XXXX` に変更します。

