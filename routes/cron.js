import crypto from 'node:crypto';
import { sendDailyReminders } from '../apps/calendar-reminder-bot/services/reminder-service.js';
import { prisma } from '../lib/prisma.js';
import { isValidConfigValue } from '../lib/slack-app-factory.js';

/**
 * JSON レスポンスを送信するヘルパー
 *
 * @param {import('node:http').ServerResponse} res - HTTP レスポンス
 * @param {number} statusCode - HTTP ステータスコード
 * @param {object} payload - 返却する JSON データ
 */
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

/**
 * リクエストヘッダーから Cron シークレットを抽出してタイミングセーフに検証する
 *
 * @param {import('node:http').IncomingMessage} req - HTTP リクエスト
 * @param {string} expectedSecret - 環境変数 CRON_SECRET の値
 * @returns {boolean} 認証に成功した場合は true
 */
const verifyCronSecret = (req, expectedSecret) => {
  const authHeader = req.headers?.authorization ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = typeof req.headers?.['x-cron-secret'] === 'string' ? req.headers['x-cron-secret'].trim() : '';
  const provided = bearerToken || headerSecret;

  if (!provided) {
    return false;
  }

  const expectedBuf = Buffer.from(expectedSecret.trim());
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
};

/**
 * 指定ワークスペース用の calendar-reminder-bot トークンを取得して Slack へメッセージを投稿する
 *
 * @param {object} params - 投稿パラメータ
 * @param {string} params.workspaceId - Slack ワークスペースID
 * @param {string} params.channelId - 投稿先チャンネルID
 * @param {string} params.text - 投稿テキスト
 * @param {import('@prisma/client').PrismaClient} params.prismaClient - PrismaClient
 * @param {NodeJS.ProcessEnv} params.env - 環境変数
 * @param {Function} params.fetchFn - fetch 関数
 */
async function postReminderToSlack({ workspaceId, channelId, text, prismaClient, env, fetchFn }) {
  // OAuth 配布時は DB からワークスペース専用の botToken を取得し、ローカル開発時は環境変数にフォールバックする
  const installation = await prismaClient.slackInstallation.findUnique({
    where: {
      appName_workspaceId: {
        appName: 'calendar-reminder-bot',
        workspaceId,
      },
    },
  });

  const botToken =
    installation?.botToken ??
    (isValidConfigValue(env.CALENDAR_REMINDER_BOT_BOT_TOKEN) ? env.CALENDAR_REMINDER_BOT_BOT_TOKEN.trim() : null);

  if (!botToken) {
    throw new Error(`calendar-reminder-bot の Bot トークンが見つかりません (workspaceId=${workspaceId})`);
  }

  const response = await fetchFn('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: channelId,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack API リクエストが失敗しました (status=${response.status})`);
  }

  const result = await response.json();
  if (!result?.ok) {
    throw new Error(`Slack chat.postMessage エラー: ${result?.error ?? 'unknown_error'}`);
  }
}

/**
 * POST /cron/remind エンドポイントのリクエストハンドラー
 * cron-job.org 等の外部スケジューラーから毎朝呼び出されることを想定している
 *
 * @param {import('node:http').IncomingMessage} req - HTTP リクエスト
 * @param {import('node:http').ServerResponse} res - HTTP レスポンス
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export async function handleCronRemindRequest(req, res, options = {}) {
  const env = options.env ?? process.env;
  const cronSecret = env.CRON_SECRET;

  if (!isValidConfigValue(cronSecret)) {
    sendJson(res, 503, { error: 'CRON_SECRET is not configured.' });
    return;
  }

  if (!verifyCronSecret(req, cronSecret)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const prismaClient = options.prismaClient === undefined ? prisma : options.prismaClient;
  const fetchFn = options.fetchFn ?? fetch;
  const sendRemindersFn = options.sendDailyReminders ?? sendDailyReminders;

  try {
    const summary = await sendRemindersFn({
      postMessage: (workspaceId, channelId, text) =>
        postReminderToSlack({ workspaceId, channelId, text, prismaClient, env, fetchFn }),
      prismaClient,
      calendarClient: options.calendarClient,
      targetDate: options.targetDate,
    });

    sendJson(res, 200, { status: 'ok', summary });
  } catch (error) {
    console.error('Cron reminder execution failed:', error);
    sendJson(res, 500, { error: error.message });
  }
}
