import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { setCalendarCallback } from '../../apps/message-calendar-bot/listeners/commands/set-calendar.js';

describe('message-calendar-bot /set-calendar', () => {
  let fakeAck;
  let fakeRespond;
  let fakeLogger;

  beforeEach(() => {
    fakeAck = mock.fn(async () => {});
    fakeRespond = mock.fn(async () => {});
    fakeLogger = { error: mock.fn() };
  });

  it('should ack, save calendar config, and respond with confirmation', async () => {
    const saveMock = mock.fn(async () => ({}));

    await setCalendarCallback(
      {
        command: { team_id: 'W123', user_id: 'U999', text: 'team-cal@group.calendar.google.com' },
        ack: fakeAck,
        respond: fakeRespond,
        logger: fakeLogger,
      },
      { upsertWorkspaceCalendarConfig: saveMock },
    );

    assert.strictEqual(fakeAck.mock.callCount(), 1);
    assert.strictEqual(saveMock.mock.callCount(), 1);
    assert.strictEqual(saveMock.mock.calls[0].arguments[0], 'W123');
    assert.deepEqual(saveMock.mock.calls[0].arguments[1], {
      googleCalendarId: 'team-cal@group.calendar.google.com',
      updatedByUserId: 'U999',
    });
    assert.strictEqual(fakeRespond.mock.callCount(), 1);
    assert(fakeRespond.mock.calls[0].arguments[0].text.includes('team-cal@group.calendar.google.com'));
  });

  it('should respond with usage guide when calendar ID argument is empty', async () => {
    const saveMock = mock.fn();

    await setCalendarCallback(
      {
        command: { team_id: 'W123', user_id: 'U999', text: '   ' },
        ack: fakeAck,
        respond: fakeRespond,
        logger: fakeLogger,
      },
      { upsertWorkspaceCalendarConfig: saveMock },
    );

    assert.strictEqual(fakeAck.mock.callCount(), 1);
    assert.strictEqual(saveMock.mock.callCount(), 0);
    assert(fakeRespond.mock.calls[0].arguments[0].text.includes('使い方:'));
  });

  it('should log error when ack throws exception', async () => {
    const testError = new Error('ack failed');
    fakeAck = mock.fn(async () => {
      throw testError;
    });

    await setCalendarCallback({
      command: { team_id: 'W123', user_id: 'U999', text: 'cal@gmail.com' },
      ack: fakeAck,
      respond: fakeRespond,
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
    assert.strictEqual(fakeLogger.error.mock.calls[0].arguments[0], testError);
  });
});
