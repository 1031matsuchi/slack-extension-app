/**
 * 年間行事予定インポーター（GAS Web アプリ）のエントリポイント雛形
 * 具体的な Excel 解析・Gemini 連携・Google カレンダー一括登録ロジックは詳細要件確定後に実装する
 *
 * @returns {GoogleAppsScript.HTML.HtmlOutput} 画面 HTML
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('年間行事予定インポーター')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
