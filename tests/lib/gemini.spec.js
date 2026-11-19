import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createGeminiClient, extractEventFromMessage } from '../../lib/gemini.js';

describe('gemini', () => {
  it('should return null from createGeminiClient when API key is missing or placeholder', () => {
    assert.strictEqual(createGeminiClient({}), null);
    assert.strictEqual(createGeminiClient({ GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY' }), null);
  });

  it('should create Gemini client when valid API key is provided', () => {
    const client = createGeminiClient({ GEMINI_API_KEY: 'AIzaSyFakeKeyForTest' });
    assert.ok(client);
  });

  it('should extract structured event from message text', async () => {
    const fakeResponse = {
      hasEvent: true,
      title: '定例ミーティング',
      allDay: false,
      date: null,
      startDateTime: '2026-11-14T15:00:00+09:00',
      endDateTime: '2026-11-14T16:00:00+09:00',
      description: '議題確認',
    };
    const generateContentMock = mock.fn(async () => ({
      text: JSON.stringify(fakeResponse),
    }));
    const fakeAiClient = { models: { generateContent: generateContentMock } };

    const result = await extractEventFromMessage('明日の15時から16時に定例ミーティング（議題確認）', '2026-11-13', {
      aiClient: fakeAiClient,
    });

    assert.strictEqual(generateContentMock.mock.callCount(), 1);
    assert.deepEqual(result, fakeResponse);
  });

  it('should throw error when message text is empty or API key is missing', async () => {
    await assert.rejects(() => extractEventFromMessage('   '), /空です/);
    await assert.rejects(() => extractEventFromMessage('テスト予定', '2026-11-13', { env: {} }), /GEMINI_API_KEY/);
  });

  it('should throw error when Gemini returns invalid JSON', async () => {
    const fakeAiClient = {
      models: {
        generateContent: mock.fn(async () => ({ text: 'not-valid-json' })),
      },
    };

    await assert.rejects(
      () => extractEventFromMessage('会議', '2026-11-13', { aiClient: fakeAiClient }),
      /JSON として解析できませんでした/,
    );
  });
});
