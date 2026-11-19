import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createGeminiClient, extractEventFromMessage, generateText } from '../../lib/gemini.js';

describe('gemini', () => {
  it('should return null from createGeminiClient when API key is missing or placeholder', () => {
    assert.strictEqual(createGeminiClient({}), null);
    assert.strictEqual(createGeminiClient({ GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY' }), null);
  });

  it('should create Gemini client when valid API key is provided', () => {
    const client = createGeminiClient({ GEMINI_API_KEY: 'AIzaSyFakeKeyForTest' });
    assert.ok(client);
  });

  it('should send prompt via generateText and return response text', async () => {
    const generateContentMock = mock.fn(async () => ({ text: 'hello from gemini' }));
    const fakeAiClient = { models: { generateContent: generateContentMock } };

    const result = await generateText('テストプロンプト', { aiClient: fakeAiClient });
    assert.strictEqual(result, 'hello from gemini');
    assert.strictEqual(generateContentMock.mock.callCount(), 1);
  });

  it('should parse JSON response in extractEventFromMessage interface', async () => {
    const fakeResponse = { title: '定例MTG' };
    const fakeAiClient = {
      models: {
        generateContent: mock.fn(async () => ({ text: JSON.stringify(fakeResponse) })),
      },
    };

    const result = await extractEventFromMessage('明日の定例MTG', { aiClient: fakeAiClient });
    assert.deepEqual(result, fakeResponse);
  });

  it('should throw error when message text is empty or API key is missing', async () => {
    await assert.rejects(() => extractEventFromMessage('   '), /空です/);
    await assert.rejects(() => extractEventFromMessage('テスト予定', { env: {} }), /GEMINI_API_KEY/);
  });

  it('should throw error when Gemini returns invalid JSON', async () => {
    const fakeAiClient = {
      models: {
        generateContent: mock.fn(async () => ({ text: 'not-valid-json' })),
      },
    };

    await assert.rejects(
      () => extractEventFromMessage('会議', { aiClient: fakeAiClient }),
      /JSON として解析できませんでした/,
    );
  });
});
