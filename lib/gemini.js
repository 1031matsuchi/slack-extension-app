import { GoogleGenAI, Type } from '@google/genai';

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
 * 単発メッセージ予定抽出用の JSON スキーマ定義
 */
const MESSAGE_EVENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hasEvent: { type: Type.BOOLEAN },
    title: { type: Type.STRING },
    allDay: { type: Type.BOOLEAN },
    date: { type: Type.STRING, nullable: true },
    startDateTime: { type: Type.STRING, nullable: true },
    endDateTime: { type: Type.STRING, nullable: true },
    description: { type: Type.STRING, nullable: true },
  },
  required: ['hasEvent', 'title', 'allDay'],
};

/**
 * Slack メッセージ本文から予定情報を構造化 JSON として抽出する（アプリ①用）
 *
 * @param {string} text - 解析対象の Slack メッセージ本文
 * @param {string} [baseDateIso] - 相対日時（「明日」「来週金曜」等）を解決するための基準日 (YYYY-MM-DD)
 * @param {object} [options={}] - DI用オプション（aiClient, env, model）
 * @returns {Promise<object>} 抽出された予定情報オブジェクト
 */
export async function extractEventFromMessage(text, baseDateIso, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('解析対象のメッセージが空です。');
  }

  const aiClient = options.aiClient ?? createGeminiClient(options.env);
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY が設定されていないため、AI 解析を利用できません。');
  }

  const referenceDate =
    baseDateIso ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const prompt = [
    'あなたは Slack メッセージからカレンダー登録用の予定を抽出するアシスタントです。',
    `基準日（日本時間 JST）: ${referenceDate}`,
    '以下のルールに従って JSON を返してください:',
    '- 予定や締め切りが含まれない場合は hasEvent を false にしてください。',
    '- 日時が「終日」または日付のみの場合は allDay: true とし、date に "YYYY-MM-DD" を設定してください。',
    '- 開始時刻がある場合は allDay: false とし、startDateTime / endDateTime に JST オフセット付きの ISO 8601 形式（例: "2026-11-15T14:00:00+09:00"）を設定してください。',
    '',
    '対象メッセージ:',
    text.trim(),
  ].join('\n');

  const response = await aiClient.models.generateContent({
    model: options.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: MESSAGE_EVENT_SCHEMA,
    },
  });

  const rawText = response?.text;
  if (!rawText) {
    throw new Error('Gemini API から空のレスポンスが返されました。');
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Gemini API の応答を JSON として解析できませんでした: ${error.message}`);
  }
}
