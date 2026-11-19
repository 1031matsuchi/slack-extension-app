import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { reactionAddedCallback } from '../../apps/message-calendar-bot/listeners/events/reaction-added.js';

describe('message-calendar-bot reaction_added (minimal skeleton)', () => {
  let fakeLogger;

  beforeEach(() => {
    fakeLogger = {
      warn: mock.fn(),
      error: mock.fn(),
    };
  });

  it('should handle message reaction event without throwing', async () => {
    await reactionAddedCallback({
      event: {
        reaction: 'calendar',
        item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
      },
      context: { teamId: 'W_TEAM_1' },
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.warn.mock.callCount(), 0);
    assert.strictEqual(fakeLogger.error.mock.callCount(), 0);
  });

  it('should warn when required identifiers are missing', async () => {
    await reactionAddedCallback({
      event: {
        reaction: 'calendar',
        item: { type: 'message' },
      },
      context: {},
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.warn.mock.callCount(), 1);
  });

  it('should catch and log error when unexpected exception occurs', async () => {
    const throwingEvent = {
      get item() {
        throw new Error('Unexpected payload error');
      },
    };

    await reactionAddedCallback({
      event: throwingEvent,
      context: { teamId: 'W_TEAM_1' },
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
  });
});
