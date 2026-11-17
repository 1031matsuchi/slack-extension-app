import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { checkTodayCallback } from '../../apps/calendar-reminder-bot/listeners/commands/check-today.js';
import { setCalendarCallback } from '../../apps/calendar-reminder-bot/listeners/commands/set-calendar.js';
import { setReminderChannelCallback } from '../../apps/calendar-reminder-bot/listeners/commands/set-reminder-channel.js';

describe('calendar-reminder-bot commands', () => {
  let fakeAck;
  let fakeRespond;
  let fakeLogger;

  beforeEach(() => {
    fakeAck = mock.fn(async () => {});
    fakeRespond = mock.fn(async () => {});
    fakeLogger = { error: mock.fn() };
  });

  it('should save reminder channel via /set-reminder-channel', async () => {
    const saveMock = mock.fn(async () => ({}));

    await setReminderChannelCallback(
      {
        command: { team_id: 'W10', channel_id: 'C999', user_id: 'U10' },
        ack: fakeAck,
        respond: fakeRespond,
        logger: fakeLogger,
      },
      { upsertWorkspaceCalendarConfig: saveMock },
    );

    assert.strictEqual(fakeAck.mock.callCount(), 1);
    assert.strictEqual(saveMock.mock.calls[0].arguments[0], 'W10');
    assert.deepEqual(saveMock.mock.calls[0].arguments[1], {
      reminderChannelId: 'C999',
      updatedByUserId: 'U10',
    });
    assert(fakeRespond.mock.calls[0].arguments[0].text.includes('<#C999>'));
  });

  it('should fetch and respond with today events via /check-today', async () => {
    const fetchMock = mock.fn(async () => [{ summary: '昼礼', start: { dateTime: '2026-11-17T12:00:00+09:00' } }]);

    await checkTodayCallback(
      {
        command: { team_id: 'W10' },
        ack: fakeAck,
        respond: fakeRespond,
        logger: fakeLogger,
      },
      { getUpcomingEvents: fetchMock, targetDate: '2026-11-17T09:00:00+09:00' },
    );

    assert.strictEqual(fakeAck.mock.callCount(), 1);
    assert.strictEqual(fetchMock.mock.calls[0].arguments[0], 'W10');
    assert(fakeRespond.mock.calls[0].arguments[0].text.includes('昼礼'));
  });

  it('should log error and respond cleanly when /check-today throws', async () => {
    const testError = new Error('Calendar missing');
    const fetchMock = mock.fn(async () => {
      throw testError;
    });

    await checkTodayCallback(
      {
        command: { team_id: 'W10' },
        ack: fakeAck,
        respond: fakeRespond,
        logger: fakeLogger,
      },
      { getUpcomingEvents: fetchMock },
    );

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
    assert(fakeRespond.mock.calls[0].arguments[0].text.includes('Calendar missing'));
  });

  it('should log error when /set-calendar ack throws', async () => {
    const testError = new Error('ack error');
    fakeAck = mock.fn(async () => {
      throw testError;
    });

    await setCalendarCallback({
      command: { team_id: 'W10', user_id: 'U1', text: 'cal@gmail.com' },
      ack: fakeAck,
      respond: fakeRespond,
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
  });
});
