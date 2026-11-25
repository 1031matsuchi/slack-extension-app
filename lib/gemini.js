import { GoogleGenAI } from '@google/genai';

// gemini-2.5-flash は 2026-12-01 に自動切替となるため、Gemini 3系の軽量モデルを採用する
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

const MOCK_DEFAULT_EVENT = {
  hasEvent: true,
  title: '【モック】テスト予定',
  allDay: true,
  date: '2026-12-01',
  startDateTime: null,
  endDateTime: null,
  description: 'MOCK_GEMINI=true による固定ダミー応答です',
};

/**
 * MOCK_GEMINI が有効（'true'）かどうかを判定する
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @param {object} [options={}] - 呼び出し元オプション（mockGemini で明示上書き可能）
 * @returns {boolean} モックモードが有効であれば true
 */
export const isMockGeminiEnabled = (env = process.env, options = {}) => {
  if (typeof options.mockGemini === 'boolean') {
    return options.mockGemini;
  }
  return (
    String(env?.MOCK_GEMINI ?? '')
      .trim()
      .toLowerCase() === 'true'
  );
};

/**
 * 使用する Gemini モデル名を決定する（options.model → env.GEMINI_MODEL → 既定値の優先順）
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @param {object} [options={}] - 呼び出し元オプション
 * @returns {string} Gemini モデル名
 */
export const resolveGeminiModel = (env = process.env, options = {}) => {
  const candidate = options.model ?? env?.GEMINI_MODEL;
  if (typeof candidate === 'string' && candidate.trim() && !candidate.includes('YOUR_')) {
    return candidate.trim();
  }
  return DEFAULT_GEMINI_MODEL;
};

/**
 * Gemini API クライアントを生成する
 * API キーが未設定またはプレースホルダー（YOUR_）の場合は null を返し、他 Bot への影響を隔離する
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @returns {GoogleGenAI | null} GoogleGenAI インスタンス、または未設定時は null
 */
export function createGeminiClient(env = process.env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim() || apiKey.includes('YOUR_')) {
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

/**
 * Gemini API へプロンプトを送信して応答テキストを取得する共通インターフェイス
 * MOCK_GEMINI=true の場合は外部 API 通信を行わず固定ダミー JSON 文字列を返却する
 *
 * @param {string} prompt - Gemini へ送信するプロンプト文字列
 * @param {object} [options={}] - DI用オプション（aiClient, env, model, thinkingLevel, mockGemini, config）
 * @returns {Promise<string>} Gemini API からの応答テキスト
 */
export async function generateText(prompt, options = {}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('送信するプロンプトが空です。');
  }

  const env = options.env ?? process.env;

  // 日常開発・自動テスト時は外部通信せず固定ダミー JSON を返却して無料枠消費と実データ漏洩を防ぐ
  if (isMockGeminiEnabled(env, options)) {
    return JSON.stringify(options.mockResponse ?? MOCK_DEFAULT_EVENT);
  }

  const aiClient = options.aiClient ?? createGeminiClient(env);
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY が設定されていないため、AI 解析を利用できません。');
  }

  const requestConfig = { ...(options.config ?? {}) };
  if (options.thinkingLevel) {
    requestConfig.thinkingConfig = {
      ...(requestConfig.thinkingConfig ?? {}),
      thinkingLevel: options.thinkingLevel,
    };
  }

  const response = await aiClient.models.generateContent({
    model: resolveGeminiModel(env, options),
    contents: prompt.trim(),
    ...(Object.keys(requestConfig).length > 0 ? { config: requestConfig } : {}),
  });

  const rawText = response?.text;
  if (!rawText) {
    throw new Error('Gemini API から空のレスポンスが返されました。');
  }

  return rawText;
}

/**
 * Slack メッセージから予定情報を抽出するためのインターフェイス（仮実装・最小骨組み）
 * 具体的なプロンプトおよび抽出項目は今後の要件定義で確定させる
 *
 * @param {string} text - 解析対象の Slack メッセージ本文
 * @param {object} [options={}] - DI用オプション（aiClient, env, model, thinkingLevel, mockGemini, prompt）
 * @returns {Promise<object>} 解析結果の JSON オブジェクト
 */
export async function extractEventFromMessage(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('解析対象のメッセージが空です。');
  }

  // 要件確定までは呼び出し元指定のプロンプト、または最小限の仮プロンプトを使用する
  const prompt = options.prompt ?? text.trim();
  const rawText = await generateText(prompt, {
    ...options,
    config: options.config ?? { responseMimeType: 'application/json' },
  });

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Gemini API の応答を JSON として解析できませんでした: ${error.message}`);
  }
}
