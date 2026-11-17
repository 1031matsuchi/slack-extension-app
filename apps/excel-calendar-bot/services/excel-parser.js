import * as XLSX from 'xlsx';

/**
 * Excel ファイルのバッファから先頭シートの行データ（2次元配列）を抽出する
 * 空白のみの行は除外して、AI へ渡すトークン量を抑える
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer - Excel ファイルのバイナリデータ
 * @returns {Array<Array<unknown>>} パースされた行データの配列
 */
export function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // すべてのセルが空の行は解析不要なため除外する
  return rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== ''));
}

/**
 * Slack のプライベートダウンロード URL から Excel ファイルを取得し、行配列へ変換する
 *
 * @param {string} downloadUrl - Slack API の url_private_download
 * @param {string} botToken - Slack Bot トークン（Bearer 認証用）
 * @param {object} [options={}] - テスト時の DI 用オプション（fetchFn）
 * @returns {Promise<Array<Array<unknown>>>} パースされた行データの配列
 */
export async function downloadAndParseExcel(downloadUrl, botToken, options = {}) {
  if (!downloadUrl || !botToken) {
    throw new Error('Excel ファイルのダウンロード URL または Bot トークンが不足しています。');
  }

  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(downloadUrl, {
    headers: {
      Authorization: `Bearer ${botToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Excel ファイルのダウンロードに失敗しました (status=${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseExcelBuffer(Buffer.from(arrayBuffer));
}
