import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import * as XLSX from 'xlsx';
import { downloadAndParseExcel, parseExcelBuffer } from '../../apps/excel-calendar-bot/services/excel-parser.js';

describe('excel-calendar-bot excel-parser', () => {
  const createSampleWorkbookBuffer = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['日付', '行事名', '備考'],
      ['2026-04-06', '始業式', '体育館'],
      ['', '', ''],
      ['2026-05-01', '遠足', '雨天中止'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '年間予定');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('should parse Excel buffer and filter out completely empty rows', () => {
    const buffer = createSampleWorkbookBuffer();
    const rows = parseExcelBuffer(buffer);

    assert.strictEqual(rows.length, 3);
    assert.deepEqual(rows[0], ['日付', '行事名', '備考']);
    assert.deepEqual(rows[1], ['2026-04-06', '始業式', '体育館']);
    assert.deepEqual(rows[2], ['2026-05-01', '遠足', '雨天中止']);
  });

  it('should download Excel using Bearer token and parse rows', async () => {
    const buffer = createSampleWorkbookBuffer();
    const fetchMock = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => buffer,
    }));

    const rows = await downloadAndParseExcel('https://files.slack.com/sample.xlsx', 'xoxb-secret', {
      fetchFn: fetchMock,
    });

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    assert.deepEqual(fetchMock.mock.calls[0].arguments[1], {
      headers: { Authorization: 'Bearer xoxb-secret' },
    });
    assert.strictEqual(rows.length, 3);
  });

  it('should throw error when download fails with non-2xx status', async () => {
    const fetchMock = mock.fn(async () => ({ ok: false, status: 403 }));
    await assert.rejects(
      () => downloadAndParseExcel('https://files.slack.com/sample.xlsx', 'xoxb-secret', { fetchFn: fetchMock }),
      /403/,
    );
  });
});
