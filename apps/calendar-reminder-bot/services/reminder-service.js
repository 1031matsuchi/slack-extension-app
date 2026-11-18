import { getUpcomingEvents } from '../../../lib/google-calendar.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * 1件の Google Calendar イベントを表示用の1行テキストへ整形する
 *
 * @param {object} event - Google Calendar API のイベントオブジェクト
 * @returns {string} 整形された予定テキスト
 */
const formatSingleEvent = (event) => {
  const title = event?.summary || '(タイトルなし)';
  if (event?.start?.date) {
    return `• [終日] *${title}*`;
  }
  if (event?.start?.dateTime) {
    const timeText = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(event.start.dateTime));
    return `• [${timeText}] *${title}*`;
  }
  return `• *${title}*`;
};

/**
 * 予定一覧から Slack 投稿用のリマインドメッセージ本文を生成する
 *
 * @param {Array<object>} events - Google Calendar イベント配列
 * @param {Date | string} [targetDate=new Date()] - 対象日
 * @returns {string} Slack 投稿用テキスト
 */
export function formatReminderMessage(events, targetDate = new Date()) {
  const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(dateObj);

  if (!Array.isArray(events) || events.length === 0) {
    return `📅 *${dateLabel} の予定*\n本日の予定はありません。`;
  }

  const lines = events.map(formatSingleEvent);
  return `📅 *${dateLabel} の予定（${events.length}件）*\n${lines.join('\n')}`;
}

/**
 * リマインド設定済みの全ワークスペースに対して本日の予定を配信する（Cron 実行用）
 * 1つのワークスペースで送信に失敗しても、他ワークスペースへの配信は継続する
 *
 * @param {object} params - 実行パラメータ
 * @param {Function} params.postMessage - (workspaceId, channelId, text) を受け取り Slack 投稿する関数
 * @param {Date | string} [params.targetDate=new Date()] - 取得対象日
 * @param {import('@prisma/client').PrismaClient | null} [params.prismaClient=prisma] - DI用 PrismaClient
 * @param {object} [params.calendarClient] - DI用 Google Calendar クライアント
 * @param {Function} [params.getUpcomingEventsFn=getUpcomingEvents] - DI用予定取得関数
 * @returns {Promise<{ total: number, succeeded: number, failed: number, errors: Array<object> }>}
 */
export async function sendDailyReminders({
  postMessage,
  targetDate = new Date(),
  prismaClient = prisma,
  calendarClient,
  getUpcomingEventsFn = getUpcomingEvents,
}) {
  if (!prismaClient) {
    throw new Error('DATABASE_URL が未設定のため、リマインド対象を取得できません。');
  }
  if (typeof postMessage !== 'function') {
    throw new Error('postMessage 関数が指定されていません。');
  }

  // カレンダーIDと通知先チャンネルIDの両方が設定されているワークスペースを抽出する
  const configs = await prismaClient.workspaceCalendarConfig.findMany({
    where: {
      reminderChannelId: { not: null },
      googleCalendarId: { not: '' },
    },
  });

  let succeeded = 0;
  const errors = [];

  for (const config of configs) {
    if (!config.reminderChannelId || !config.googleCalendarId) {
      continue;
    }

    try {
      const events = await getUpcomingEventsFn(config.workspaceId, targetDate, {
        calendarClient,
        prismaClient,
      });
      const text = formatReminderMessage(events, targetDate);
      await postMessage(config.workspaceId, config.reminderChannelId, text);
      succeeded += 1;
    } catch (error) {
      errors.push({
        workspaceId: config.workspaceId,
        message: error.message,
      });
    }
  }

  return {
    total: configs.length,
    succeeded,
    failed: errors.length,
    errors,
  };
}
