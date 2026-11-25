import { prisma } from '../../../lib/prisma.js';

/**
 * 予定一覧を Slack 投稿用テキストへ変換する最小骨組み関数
 * 具体的な通知フォーマットや項目は今後の要件定義で確定させる
 *
 * @param {Array<object>} events - Google Calendar イベント配列
 * @returns {string} Slack 投稿用テキスト
 */
export function formatReminderMessage(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return '予定はありません。';
  }

  return events.map((event) => `• ${event?.summary || '(タイトルなし)'}`).join('\n');
}

/**
 * リマインド設定済みのワークスペースを対象に配信処理を行う最小骨組み（Cron 実行用）
 * 具体的な対象抽出条件・取得期間・通知フローは今後の要件定義後に実装する
 * 1つのワークスペースで失敗しても他ワークスペースの処理を止めないよう個別に try...catch で隔離している
 *
 * @param {object} params - 実行パラメータ
 * @param {Function} [params.postMessage] - Slack 投稿用コールバック
 * @param {import('@prisma/client').PrismaClient | null} [params.prismaClient=prisma] - DI用 PrismaClient
 * @returns {Promise<{ total: number, succeeded: number, failed: number, errors: Array<object> }>}
 */
export async function sendDailyReminders({ postMessage, prismaClient = prisma } = {}) {
  if (!prismaClient) {
    throw new Error('DATABASE_URL が未設定のため、リマインド対象を取得できません。');
  }
  if (typeof postMessage !== 'function') {
    throw new Error('postMessage 関数が指定されていません。');
  }

  const configs = await prismaClient.workspaceCalendarConfig.findMany({
    where: {
      reminderChannelId: { not: null },
      googleCalendarId: { not: '' },
    },
  });

  const errors = [];
  for (const config of configs) {
    try {
      // 要件定義後に Google カレンダー予定の取得・整形・postMessage 送信をここへ接続する
      if (!config.workspaceId) {
        throw new Error('workspaceId が設定されていません。');
      }
    } catch (error) {
      errors.push({
        workspaceId: config.workspaceId,
        message: error.message,
      });
    }
  }

  return {
    total: configs.length,
    succeeded: configs.length - errors.length,
    failed: errors.length,
    errors,
  };
}
