import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { reactionAddedCallback } from '../../apps/message-calendar-bot/listeners/events/reaction-added.js';

describe('message-calendar-bot reaction_added', () => {
  let fakeClient;
  let fakeLogger;

  beforeEach(() => {
    fakeClient = {
      conversations: {
        history: mock.fn(async () => ({
          messages: [{ text: '来週月曜日の15時から定例会議です' }],
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

  it('should extract event from message, insert to Google Calendar, and reply in thread', async () => {
    const extractMock = mock.fn(async () => ({
      hasEvent: true,
      title: '定例会議',
      allDay: false,
      startDateTime: '2026-11-23T15:00:00+09:00',
    }));
    const insertMock = mock.fn(async () => ({
      id: 'evt_1',
      htmlLink: 'https://calendar.google.com/event?eid=1',
    }));

    await reactionAddedCallback(
      {
        event: {
          reaction: 'calendar',
          item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
        },
        context: { teamId: 'W_TEAM_1' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { extractEventFromMessage: extractMock, insertEvent: insertMock },
    );

    assert.strictEqual(extractMock.mock.callCount(), 1);
    assert.strictEqual(insertMock.mock.callCount(), 1);
    assert.strictEqual(insertMock.mock.calls[0].arguments[0], 'W_TEAM_1');
    assert.strictEqual(fakeClient.chat.postMessage.mock.callCount(), 1);
    const postArgs = fakeClient.chat.postMessage.mock.calls[0].arguments[0];
    assert.strictEqual(postArgs.thread_ts, '1700000000.000100');
    assert(postArgs.text.includes('定例会議'));
  });

  it('should ignore reactions other than calendar emojis', async () => {
    const extractMock = mock.fn();
    await reactionAddedCallback(
      {
        event: {
          reaction: 'thumbsup',
          item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
        },
        context: { teamId: 'W_TEAM_1' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { extractEventFromMessage: extractMock },
    );

    assert.strictEqual(fakeClient.conversations.history.mock.callCount(), 0);
    assert.strictEqual(extractMock.mock.callCount(), 0);
  });

  it('should reply notice when no event is found in message', async () => {
    const extractMock = mock.fn(async () => ({ hasEvent: false, title: '', allDay: false }));
    const insertMock = mock.fn();

    await reactionAddedCallback(
      {
        event: {
          reaction: 'spiral_calendar_pad',
          item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
        },
        context: { teamId: 'W_TEAM_1' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { extractEventFromMessage: extractMock, insertEvent: insertMock },
    );

    assert.strictEqual(insertMock.mock.callCount(), 0);
    assert.strictEqual(fakeClient.chat.postMessage.mock.callCount(), 1);
    assert(fakeClient.chat.postMessage.mock.calls[0].arguments[0].text.includes('予定が見つかりませんでした'));
  });

  it('should log error and notify thread when exception is thrown', async () => {
    const testError = new Error('Gemini API failure');
    const extractMock = mock.fn(async () => {
      throw testError;
    });

    await reactionAddedCallback(
      {
        event: {
          reaction: 'calendar',
          item: { type: 'message', channel: 'C123', ts: '1700000000.000100' },
        },
        context: { teamId: 'W_TEAM_1' },
        client: fakeClient,
        logger: fakeLogger,
      },
      { extractEventFromMessage: extractMock },
    );

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
    assert.strictEqual(fakeLogger.error.mock.calls[0].arguments[0], testError);
    assert(fakeClient.chat.postMessage.mock.calls[0].arguments[0].text.includes('Gemini API failure'));
  });
});
