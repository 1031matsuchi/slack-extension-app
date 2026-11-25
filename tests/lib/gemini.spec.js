import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import {
  createGeminiClient,
  DEFAULT_GEMINI_MODEL,
  extractEventFromMessage,
  generateText,
  resolveGeminiModel,
} from '../../lib/gemini.js';

describe('gemini', () => {
  it('should return null from createGeminiClient when API key is missing or placeholder', () => {
    assert.strictEqual(createGeminiClient({}), null);
    assert.strictEqual(createGeminiClient({ GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY' }), null);
  });

  it('should create Gemini client when valid API key is provided', () => {
    const client = createGeminiClient({ GEMINI_API_KEY: 'AIzaSyFakeKeyForTest' });
    assert.ok(client);
  });

  it('should resolve model from options, GEMINI_MODEL env, or default gemini-3.5-flash-lite', () => {
    assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite');
    assert.strictEqual(resolveGeminiModel({}), 'gemini-3.5-flash-lite');
    assert.strictEqual(resolveGeminiModel({ GEMINI_MODEL: 'gemini-3.8-flash' }), 'gemini-3.8-flash');
    assert.strictEqual(
      resolveGeminiModel({ GEMINI_MODEL: 'gemini-3.8-flash' }, { model: 'custom-model' }),
      'custom-model',
    );
  });

  it('should return mock JSON without calling external API when MOCK_GEMINI=true', async () => {
    const generateContentMock = mock.fn();
    const fakeAiClient = { models: { generateContent: generateContentMock } };

    const result = await extractEventFromMessage('明日のテスト予定', {
      env: { MOCK_GEMINI: 'true' },
      aiClient: fakeAiClient,
    });

    assert.strictEqual(generateContentMock.mock.callCount(), 0);
    assert.strictEqual(result.hasEvent, true);
    assert(result.title.includes('モック'));
  });

  it('should send prompt via generateText with resolved model and thinkingLevel', async () => {
    const generateContentMock = mock.fn(async () => ({ text: 'hello from gemini' }));
    const fakeAiClient = { models: { generateContent: generateContentMock } };

    const result = await generateText('テストプロンプト', {
      env: { GEMINI_MODEL: 'gemini-3.5-flash-lite' },
      thinkingLevel: 'minimal',
      aiClient: fakeAiClient,
    });

    assert.strictEqual(result, 'hello from gemini');
    assert.strictEqual(generateContentMock.mock.callCount(), 1);
    const callArgs = generateContentMock.mock.calls[0].arguments[0];
    assert.strictEqual(callArgs.model, 'gemini-3.5-flash-lite');
    assert.strictEqual(callArgs.config.thinkingConfig.thinkingLevel, 'minimal');
  });

  it('should parse JSON response in extractEventFromMessage interface', async () => {
    const fakeResponse = { title: '定例MTG' };
    const fakeAiClient = {
      models: {
        generateContent: mock.fn(async () => ({ text: JSON.stringify(fakeResponse) })),
      },
    };

    const result = await extractEventFromMessage('明日の定例MTG', {
      env: {},
      aiClient: fakeAiClient,
    });
    assert.deepEqual(result, fakeResponse);
  });

  it('should throw error when message text is empty or API key is missing (non-mock)', async () => {
    await assert.rejects(() => extractEventFromMessage('   ', { env: {} }), /空です/);
    await assert.rejects(() => extractEventFromMessage('テスト予定', { env: {} }), /GEMINI_API_KEY/);
  });

  it('should throw error when Gemini returns invalid JSON', async () => {
    const fakeAiClient = {
      models: {
        generateContent: mock.fn(async () => ({ text: 'not-valid-json' })),
      },
    };

    await assert.rejects(
      () => extractEventFromMessage('会議', { env: {}, aiClient: fakeAiClient }),
      /JSON として解析できませんでした/,
    );
  });
});
