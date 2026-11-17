import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  formatReminderMessage,
  sendDailyReminders,
} from '../../apps/calendar-reminder-bot/services/reminder-service.js';

describe('calendar-reminder-bot reminder-service', () => {
  it('should format empty events list cleanly', () => {
    const msg = formatReminderMessage([], '2026-11-17T09:00:00+09:00');
    assert(msg.includes('本日の予定はありません'));
  });

  it('should format all-day and timed events', () => {
    const msg = formatReminderMessage(
      [
        { summary: '創立記念日', start: { date: '2026-11-17' } },
        { summary: '定例MTG', start: { dateTime: '2026-11-17T10:30:00+09:00' } },
      ],
      '2026-11-17T09:00:00+09:00',
    );
    assert(msg.includes('（2件）'));
    assert(msg.includes('[終日] *創立記念日*'));
    assert(msg.includes('[10:30] *定例MTG*'));
  });

  it('should send reminders to all configured workspaces and isolate failures', async () => {
    const fakePrisma = {
      workspaceCalendarConfig: {
        findMany: mock.fn(async () => [
          { workspaceId: 'W1', googleCalendarId: 'cal1@gmail.com', reminderChannelId: 'C1' },
          { workspaceId: 'W2', googleCalendarId: 'cal2@gmail.com', reminderChannelId: 'C2' },
        ]),
      },
    };
    const getEventsMock = mock.fn(async (workspaceId) => {
      if (workspaceId === 'W1') {
        throw new Error('Calendar not shared');
      }
      return [{ summary: '朝会', start: { dateTime: '2026-11-17T09:00:00+09:00' } }];
    });
    const postMessageMock = mock.fn(async () => {});

    const summary = await sendDailyReminders({
      postMessage: postMessageMock,
      targetDate: '2026-11-17T09:00:00+09:00',
      prismaClient: fakePrisma,
      getUpcomingEventsFn: getEventsMock,
    });

    assert.strictEqual(summary.total, 2);
    assert.strictEqual(summary.succeeded, 1);
    assert.strictEqual(summary.failed, 1);
    assert.strictEqual(summary.errors[0].workspaceId, 'W1');
    assert.strictEqual(postMessageMock.mock.callCount(), 1);
    assert.strictEqual(postMessageMock.mock.calls[0].arguments[0], 'W2');
    assert.strictEqual(postMessageMock.mock.calls[0].arguments[1], 'C2');
  });
});
