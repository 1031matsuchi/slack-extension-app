import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  formatReminderMessage,
  sendDailyReminders,
} from '../../apps/calendar-reminder-bot/services/reminder-service.js';

describe('calendar-reminder-bot reminder-service (minimal skeleton)', () => {
  it('should format empty and non-empty events lists minimally', () => {
    assert.strictEqual(formatReminderMessage([]), '予定はありません。');
    const text = formatReminderMessage([{ summary: '定例MTG' }]);
    assert(text.includes('定例MTG'));
  });

  it('should iterate configured workspaces and return summary without throwing', async () => {
    const fakePrisma = {
      workspaceCalendarConfig: {
        findMany: mock.fn(async () => [
          { workspaceId: 'W1', googleCalendarId: 'cal1@gmail.com', reminderChannelId: 'C1' },
          { workspaceId: '', googleCalendarId: 'cal2@gmail.com', reminderChannelId: 'C2' },
        ]),
      },
    };

    const summary = await sendDailyReminders({
      postMessage: mock.fn(async () => {}),
      prismaClient: fakePrisma,
    });

    assert.strictEqual(summary.total, 2);
    assert.strictEqual(summary.succeeded, 1);
    assert.strictEqual(summary.failed, 1);
  });

  it('should throw error when prismaClient or postMessage is missing', async () => {
    await assert.rejects(() => sendDailyReminders({ prismaClient: null, postMessage: () => {} }), /DATABASE_URL/);
    await assert.rejects(() => sendDailyReminders({ prismaClient: {} }), /postMessage/);
  });
});
