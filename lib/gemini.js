import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash';

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
 * 具体的なプロンプト設計は今後の要件定義に合わせて各 Bot 側から渡す
 *
 * @param {string} prompt - Gemini へ送信するプロンプト文字列
 * @param {object} [options={}] - DI用オプション（aiClient, env, model, config）
 * @returns {Promise<string>} Gemini API からの応答テキスト
 */
export async function generateText(prompt, options = {}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('送信するプロンプトが空です。');
  }

  const aiClient = options.aiClient ?? createGeminiClient(options.env);
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY が設定されていないため、AI 解析を利用できません。');
  }

  const response = await aiClient.models.generateContent({
    model: options.model ?? DEFAULT_MODEL,
    contents: prompt.trim(),
    ...(options.config ? { config: options.config } : {}),
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
 * @param {object} [options={}] - DI用オプション（aiClient, env, model, prompt）
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
