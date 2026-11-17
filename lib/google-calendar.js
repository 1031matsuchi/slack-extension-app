import { google } from 'googleapis';
import { prisma } from './prisma.js';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const DEFAULT_TIMEZONE = 'Asia/Tokyo';

/**
 * 設定値が有効（未設定・空文字・YOUR_ プレースホルダーでない）か判定する
 *
 * @param {string | undefined} value - 検証対象の環境変数値
 * @returns {boolean} 有効な値であれば true
 */
const isValidEnvValue = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('YOUR_')) {
    return false;
  }
  return true;
};

/**
 * Google Calendar API クライアントを生成する（案A: サービスアカウント認証）
 * 環境変数が未設定またはプレースホルダーの場合は null を返し、他 Bot への影響を隔離する
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @returns {import('googleapis').calendar_v3.Calendar | null} Calendar クライアント、または未設定時は null
 */
export function createCalendarClient(env = process.env) {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = env.GOOGLE_PRIVATE_KEY;

  if (!isValidEnvValue(email) || !isValidEnvValue(rawPrivateKey)) {
    return null;
  }

  // .env 等でエスケープされた "\n" を実際の改行コードへ復元する
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: email.trim(),
    key: privateKey,
    scopes: [CALENDAR_SCOPE],
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * 指定ワークスペースの Google カレンダー設定を DB から取得する
 *
 * @param {string} workspaceId - Slack ワークスペースID
 * @param {import('@prisma/client').PrismaClient | null} [prismaClient=prisma] - PrismaClient
 * @returns {Promise<object | null>} 設定レコード、または未設定・DB未接続時は null
 */
export async function getWorkspaceCalendarConfig(workspaceId, prismaClient = prisma) {
  if (!prismaClient || !workspaceId) {
    return null;
  }
  return prismaClient.workspaceCalendarConfig.findUnique({
    where: { workspaceId },
  });
}

/**
 * YYYY-MM-DD 形式の日付文字列に指定日数を加算した文字列を返す
 * Google Calendar API の終日イベント終了日（排他的）を計算するために使用する
 *
 * @param {string} dateStr - 'YYYY-MM-DD' 形式の日付
 * @param {number} [days=1] - 加算する日数
 * @returns {string} 'YYYY-MM-DD' 形式の計算結果
 */
const addDaysToDateString = (dateStr, days = 1) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

/**
 * 予定データから Google Calendar API 用のイベントリソースを構築する
 *
 * @param {object} eventData - 予定データ
 * @param {string} eventData.title - 予定のタイトル
 * @param {string} [eventData.description] - 予定の説明
 * @param {boolean} [eventData.allDay] - 終日イベントフラグ
 * @param {string} [eventData.date] - 終日イベントの日付 (YYYY-MM-DD)
 * @param {string} [eventData.endDate] - 終日イベントの終了日 (YYYY-MM-DD)
 * @param {string} [eventData.startDateTime] - 開始日時 (ISO 8601)
 * @param {string} [eventData.endDateTime] - 終了日時 (ISO 8601)
 * @returns {object} Google Calendar API events.insert 用の requestBody
 */
export function buildGoogleEventResource(eventData) {
  if (!eventData?.title) {
    throw new Error('予定のタイトル（title）は必須です。');
  }

  const isAllDay = Boolean(eventData.allDay || (eventData.date && !eventData.startDateTime));

  if (isAllDay) {
    if (!eventData.date) {
      throw new Error('終日イベントには日付（date: YYYY-MM-DD）が必要です。');
    }
    // Google Calendar API の終日イベントは終了日が排他的（翌日指定）のため +1日 する
    const endDate = eventData.endDate || addDaysToDateString(eventData.date, 1);

    return {
      summary: eventData.title,
      description: eventData.description ?? undefined,
      start: { date: eventData.date },
      end: { date: endDate },
    };
  }

  if (!eventData.startDateTime) {
    throw new Error('時間指定イベントには開始日時（startDateTime）が必要です。');
  }

  // 終了日時が省略された場合は開始の1時間後をデフォルトにする
  const endDateTime =
    eventData.endDateTime || new Date(new Date(eventData.startDateTime).getTime() + 60 * 60 * 1000).toISOString();

  return {
    summary: eventData.title,
    description: eventData.description ?? undefined,
    start: { dateTime: eventData.startDateTime, timeZone: DEFAULT_TIMEZONE },
    end: { dateTime: endDateTime, timeZone: DEFAULT_TIMEZONE },
  };
}

/**
 * ワークスペースのカレンダー設定と Google Calendar クライアントを検証して返す内部ヘルパー
 *
 * @param {string} workspaceId - Slack ワークスペースID
 * @param {object} options - DI用オプション
 * @returns {Promise<{ calendar: object, calendarId: string }>}
 */
async function resolveCalendarContext(workspaceId, options = {}) {
  const calendar = options.calendarClient ?? createCalendarClient(options.env);
  if (!calendar) {
    throw new Error('Google サービスアカウント認証情報が設定されていません。');
  }

  const db = options.prismaClient === undefined ? prisma : options.prismaClient;
  const config = await getWorkspaceCalendarConfig(workspaceId, db);
  if (!config?.googleCalendarId) {
    throw new Error('このワークスペースには Google カレンダーが設定されていません。/set-calendar で設定してください。');
  }

  return { calendar, calendarId: config.googleCalendarId };
}

/**
 * Google Calendar API エラーをユーザー向けの分かりやすいメッセージへ変換する
 *
 * @param {Error & { code?: number, status?: number }} error - Google API からのエラー
 * @returns {Error} 変換後のエラー
 */
const wrapGoogleApiError = (error) => {
  const status = error?.code ?? error?.status ?? error?.response?.status;
  if (status === 403 || status === 404) {
    return new Error(
      'Google カレンダーへアクセスできません。カレンダーIDが正しいか、サービスアカウントに編集権限で共有されているか確認してください。',
    );
  }
  return error;
};

/**
 * 単発の予定をワークスペースの Google カレンダーへ登録する（アプリ①用）
 *
 * @param {string} workspaceId - Slack ワークスペースID
 * @param {object} eventData - 登録する予定データ
 * @param {object} [options={}] - DI用オプション（calendarClient, prismaClient, env）
 * @returns {Promise<object>} 登録された Google Calendar イベントデータ
 */
export async function insertEvent(workspaceId, eventData, options = {}) {
  const { calendar, calendarId } = await resolveCalendarContext(workspaceId, options);
  const requestBody = buildGoogleEventResource(eventData);

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody,
    });
    return response.data;
  } catch (error) {
    throw wrapGoogleApiError(error);
  }
}

/**
 * 複数の予定をワークスペースの Google カレンダーへ一括登録する（アプリ②用）
 * 1件失敗しても残りの予定登録を続行し、結果サマリーを返す
 *
 * @param {string} workspaceId - Slack ワークスペースID
 * @param {Array<object>} eventsList - 登録する予定データの配列
 * @param {object} [options={}] - DI用オプション（calendarClient, prismaClient, env）
 * @returns {Promise<{ total: number, succeeded: number, failed: number, createdEvents: Array<object>, errors: Array<object> }>}
 */
export async function insertBatchEvents(workspaceId, eventsList, options = {}) {
  if (!Array.isArray(eventsList) || eventsList.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, createdEvents: [], errors: [] };
  }

  const { calendar, calendarId } = await resolveCalendarContext(workspaceId, options);
  const createdEvents = [];
  const errors = [];

  for (const eventData of eventsList) {
    try {
      const requestBody = buildGoogleEventResource(eventData);
      const response = await calendar.events.insert({
        calendarId,
        requestBody,
      });
      createdEvents.push(response.data);
    } catch (error) {
      const wrapped = wrapGoogleApiError(error);
      errors.push({
        title: eventData?.title ?? '(不明な予定)',
        message: wrapped.message,
      });
    }
  }

  return {
    total: eventsList.length,
    succeeded: createdEvents.length,
    failed: errors.length,
    createdEvents,
    errors,
  };
}

/**
 * 指定日（JST 基準の 00:00:00 〜 23:59:59）の予定一覧を Google カレンダーから取得する（アプリ③用）
 *
 * @param {string} workspaceId - Slack ワークスペースID
 * @param {Date | string} [targetDate=new Date()] - 取得対象の日付
 * @param {object} [options={}] - DI用オプション（calendarClient, prismaClient, env）
 * @returns {Promise<Array<object>>} 予定オブジェクトの配列
 */
export async function getUpcomingEvents(workspaceId, targetDate = new Date(), options = {}) {
  const { calendar, calendarId } = await resolveCalendarContext(workspaceId, options);

  // 日本標準時（+09:00）における対象日の YYYY-MM-DD を算出する
  const baseDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const jstDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate);

  const timeMin = `${jstDateStr}T00:00:00+09:00`;
  const timeMax = `${jstDateStr}T23:59:59+09:00`;

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: DEFAULT_TIMEZONE,
    });
    return response.data?.items ?? [];
  } catch (error) {
    throw wrapGoogleApiError(error);
  }
}
