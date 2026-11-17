import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { fileSharedCallback } from '../../apps/excel-calendar-bot/listeners/events/file-shared.js';

describe('excel-calendar-bot file_shared', () => {
  let fakeClient;
  let fakeLogger;

  beforeEach(() => {
    fakeClient = {
      files: {
        info: mock.fn(async () => ({
          file: {
            name: 'annual-schedule-2026.xlsx',
            url_private_download: 'https://files.slack.com/annual.xlsx',
          },
        })),
      },
      chat: {
        postMessage: mock.fn(async () => ({ ok: true })),
      },
    };
    fakeLogger = {
      warn: mock.fn(),
      error: mock.fn(),
    };
  });

  it('should parse uploaded Excel, insert batch events, and post summary', async () => {
    const downloadMock = mock.fn(async () => [
      ['日付', '行事名'],
      ['2026-04-06', '始業式'],
    ]);
    const parseMock = mock.fn(async () => [{ title: '始業式', allDay: true, date: '2026-04-06' }]);
    const insertBatchMock = mock.fn(async () => ({
      total: 1,
      succeeded: 1,
      failed: 0,
      errors: [],
    }));

    await fileSharedCallback(
      {
        event: { file_id: 'F123', channel_id: 'C123' },
        context: { teamId: 'W_TEAM_2', botToken: 'xoxb-123' },
        client: fakeClient,
        logger: fakeLogger,
      },
      {
        downloadAndParseExcel: downloadMock,
        parseYearlyEventsFromExcel: parseMock,
        insertBatchEvents: insertBatchMock,
      },
    );

    assert.strictEqual(downloadMock.mock.callCount(), 1);
    assert.strictEqual(parseMock.mock.callCount(), 1);
    assert.strictEqual(insertBatchMock.mock.callCount(), 1);
    assert.strictEqual(insertBatchMock.mock.calls[0].arguments[0], 'W_TEAM_2');
    assert.strictEqual(fakeClient.chat.postMessage.mock.callCount(), 1);
    assert(fakeClient.chat.postMessage.mock.calls[0].arguments[0].text.includes('1件'));
  });

  it('should ignore non-Excel files', async () => {
    fakeClient.files.info = mock.fn(async () => ({
      file: { name: 'screenshot.png', url_private_download: 'https://files.slack.com/s.png' },
    }));
    const downloadMock = mock.fn();

    await fileSharedCallback(
      {
        event: { file_id: 'F999', channel_id: 'C123' },
        context: { teamId: 'W_TEAM_2', botToken: 'xoxb-123' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { downloadAndParseExcel: downloadMock },
    );

    assert.strictEqual(downloadMock.mock.callCount(), 0);
    assert.strictEqual(fakeClient.chat.postMessage.mock.callCount(), 0);
  });

  it('should log error and notify channel when exception occurs', async () => {
    const testError = new Error('Excel parse error');
    const downloadMock = mock.fn(async () => {
      throw testError;
    });

    await fileSharedCallback(
      {
        event: { file_id: 'F123', channel_id: 'C123' },
        context: { teamId: 'W_TEAM_2', botToken: 'xoxb-123' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { downloadAndParseExcel: downloadMock },
    );

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
    assert.strictEqual(fakeLogger.error.mock.calls[0].arguments[0], testError);
    assert(fakeClient.chat.postMessage.mock.calls[0].arguments[0].text.includes('Excel parse error'));
  });
});
