import { formatReminderMessage } from '../apps/calendar-reminder-bot/services/reminder-service.js';
import { getUpcomingEvents, getWorkspaceCalendarConfig, upsertWorkspaceCalendarConfig } from './google-calendar.js';

export const ACTION_OPEN_SETTINGS = 'open_calendar_settings_modal';
export const ACTION_CHECK_TODAY = 'check_today_events';
export const VIEW_SETTINGS_MODAL = 'save_calendar_settings_modal';

const BLOCK_CALENDAR_ID = 'calendar_id_block';
const INPUT_CALENDAR_ID = 'calendar_id_input';
const BLOCK_REMINDER_CHANNEL = 'reminder_channel_block';
const INPUT_REMINDER_CHANNEL = 'reminder_channel_select';

/**
 * アプリホームタブ（Home View）の Block Kit JSON を構築する
 *
 * @param {object} params - 画面構築パラメータ
 * @param {string} params.appName - アプリ識別名
 * @param {string} params.userId - 表示対象の Slack ユーザーID
 * @param {object | null} params.config - DB から取得したワークスペース設定
 * @param {string | undefined} params.serviceAccountEmail - 共有用 Google サービスアカウントメール
 * @param {boolean} [params.includeReminderOptions=false] - リマインダー関連の表示・ボタンを含めるか
 * @returns {object} Slack views.publish 用の view オブジェクト
 */
export function buildAppHomeView({ appName, userId, config, serviceAccountEmail, includeReminderOptions = false }) {
  const calendarText = config?.googleCalendarId ? `\`${config.googleCalendarId}\`` : '_未設定_';
  const channelText = config?.reminderChannelId ? `<#${config.reminderChannelId}>` : '_未設定_';
  const serviceAccountText = serviceAccountEmail
    ? `\`${serviceAccountEmail}\``
    : '_（管理者の環境変数 GOOGLE_SERVICE_ACCOUNT_EMAIL が未設定です）_';

  const statusLines = [`• *連携中の Google カレンダーID*: ${calendarText}`];
  if (includeReminderOptions) {
    statusLines.push(`• *リマインド通知先チャンネル*: ${channelText}`);
  }

  const actionElements = [
    {
      type: 'button',
      text: {
        type: 'plain_text',
        text: '⚙️ カレンダー・通知先を設定する',
        emoji: true,
      },
      style: 'primary',
      action_id: ACTION_OPEN_SETTINGS,
    },
  ];

  if (includeReminderOptions) {
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: '📅 今日の予定を今すぐ確認',
        emoji: true,
      },
      action_id: ACTION_CHECK_TODAY,
    });
  }

  return {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 ${appName} 設定ダッシュボード`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `こんにちは <@${userId}> さん！この画面から Google カレンダー連携の設定や確認を行えます。`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*現在の設定状況*\n${statusLines.join('\n')}`,
        },
      },
      {
        type: 'actions',
        elements: actionElements,
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*事前準備（Google カレンダー側の共有設定）*',
            '1. 連携したい Google カレンダーの「設定と共有」を開きます。',
            `2. 「特定のユーザーやグループと共有する」に以下のアドレスを *「予定の変更」権限* で追加してください：\n   ${serviceAccountText}`,
            '3. 「カレンダーの統合」欄にあるカレンダー ID（例: `xxxx@group.calendar.google.com`）を上のボタンから登録してください。',
          ].join('\n'),
        },
      },
    ],
  };
}

/**
 * カレンダー・通知先設定用のモーダル（Modal View）を構築する
 *
 * @param {object} params - モーダル構築パラメータ
 * @param {object | null} params.config - 現在の設定レコード（初期値表示用）
 * @param {boolean} [params.includeReminderChannel=false] - 通知先チャンネル選択を含めるか
 * @param {string} [params.privateMetadata=''] - 保存時に参照するメタデータ JSON
 * @returns {object} Slack views.open 用の view オブジェクト
 */
export function buildSettingsModal({ config, includeReminderChannel = false, privateMetadata = '' }) {
  const blocks = [
    {
      type: 'input',
      block_id: BLOCK_CALENDAR_ID,
      label: {
        type: 'plain_text',
        text: 'Google カレンダー ID',
      },
      element: {
        type: 'plain_text_input',
        action_id: INPUT_CALENDAR_ID,
        initial_value: config?.googleCalendarId || '',
        placeholder: {
          type: 'plain_text',
          text: '例: xxxx@group.calendar.google.com',
        },
      },
      hint: {
        type: 'plain_text',
        text: 'Google カレンダーの「設定と共有」→「カレンダーの統合」にある ID を入力してください。',
      },
    },
  ];

  if (includeReminderChannel) {
    const selectElement = {
      type: 'conversations_select',
      action_id: INPUT_REMINDER_CHANNEL,
      placeholder: {
        type: 'plain_text',
        text: 'リマインドを投稿するチャンネルを選択',
      },
      filter: {
        include: ['public', 'private'],
        exclude_bot_users: true,
      },
    };
    if (config?.reminderChannelId) {
      selectElement.initial_conversation = config.reminderChannelId;
    }

    blocks.push({
      type: 'input',
      block_id: BLOCK_REMINDER_CHANNEL,
      optional: true,
      label: {
        type: 'plain_text',
        text: 'リマインド通知先チャンネル',
      },
      element: selectElement,
    });
  }

  return {
    type: 'modal',
    callback_id: VIEW_SETTINGS_MODAL,
    private_metadata: privateMetadata,
    title: {
      type: 'plain_text',
      text: 'カレンダー連携設定',
    },
    submit: {
      type: 'plain_text',
      text: '保存する',
    },
    close: {
      type: 'plain_text',
      text: 'キャンセル',
    },
    blocks,
  };
}

/**
 * ホームタブを最新の設定内容で再描画する内部ヘルパー
 */
async function publishHomeView({ client, userId, workspaceId, appName, includeReminderOptions, getConfigFn, env }) {
  const config = await getConfigFn(workspaceId);
  const view = buildAppHomeView({
    appName,
    userId,
    config,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    includeReminderOptions,
  });

  await client.views.publish({
    user_id: userId,
    view,
  });
}

/**
 * 3つのアプリで共通利用できる GUI セットアップ用リスナーを一括登録する
 *
 * @param {import('@slack/bolt').App} app - Slack Bolt App インスタンス
 * @param {object} config - アプリ固有設定
 * @param {string} config.appName - アプリ識別名
 * @param {boolean} [config.includeReminderOptions=false] - リマインダーBot向けボタン・チャンネル設定を有効にするか
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export function registerSetupUiListeners(app, { appName, includeReminderOptions = false }, options = {}) {
  const getConfigFn = options.getWorkspaceCalendarConfig ?? getWorkspaceCalendarConfig;
  const saveConfigFn = options.upsertWorkspaceCalendarConfig ?? upsertWorkspaceCalendarConfig;
  const getEventsFn = options.getUpcomingEvents ?? getUpcomingEvents;
  const env = options.env ?? process.env;

  // 1. アプリのホームタブを開いたときの設定ダッシュボード表示
  app.event('app_home_opened', async ({ event, context, body, client, logger }) => {
    try {
      if (event?.tab !== 'home') {
        return;
      }
      const workspaceId = context?.teamId ?? body?.team_id;
      await publishHomeView({
        client,
        userId: event.user,
        workspaceId,
        appName,
        includeReminderOptions,
        getConfigFn,
        env,
      });
    } catch (error) {
      logger.error(error);
    }
  });

  // 2. 「⚙️ カレンダー・通知先を設定する」ボタン押下時のモーダル表示
  app.action(ACTION_OPEN_SETTINGS, async ({ ack, body, context, client, logger }) => {
    try {
      // 3秒以内の ack() を最優先で実行
      await ack();

      const workspaceId = context?.teamId ?? body?.team?.id;
      const config = await getConfigFn(workspaceId);
      const modal = buildSettingsModal({
        config,
        includeReminderChannel: includeReminderOptions,
        privateMetadata: JSON.stringify({ appName, includeReminderOptions }),
      });

      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal,
      });
    } catch (error) {
      logger.error(error);
    }
  });

  // 3. モーダル「保存する」送信時の DB 保存＆ホーム画面自動更新
  app.view(VIEW_SETTINGS_MODAL, async ({ ack, body, view, context, client, logger }) => {
    try {
      await ack();

      const workspaceId = context?.teamId ?? body?.team?.id;
      const userId = body?.user?.id;
      const values = view?.state?.values ?? {};

      const calendarId = values[BLOCK_CALENDAR_ID]?.[INPUT_CALENDAR_ID]?.value?.trim();
      const reminderChannelId = values[BLOCK_REMINDER_CHANNEL]?.[INPUT_REMINDER_CHANNEL]?.selected_conversation;

      const updatePayload = {
        googleCalendarId: calendarId,
        updatedByUserId: userId,
      };
      if (includeReminderOptions) {
        updatePayload.reminderChannelId = reminderChannelId ?? null;
      }

      await saveConfigFn(workspaceId, updatePayload);

      // 保存後すぐにホーム画面を最新化してユーザーに反映を見せる
      if (userId) {
        await publishHomeView({
          client,
          userId,
          workspaceId,
          appName,
          includeReminderOptions,
          getConfigFn,
          env,
        });
      }
    } catch (error) {
      logger.error(error);
    }
  });

  // 4. 「📅 今日の予定を今すぐ確認」ボタン押下時（calendar-reminder-bot 用）
  if (includeReminderOptions) {
    app.action(ACTION_CHECK_TODAY, async ({ ack, body, context, client, logger }) => {
      try {
        await ack();

        const workspaceId = context?.teamId ?? body?.team?.id;
        const userId = body?.user?.id;
        const targetDate = options.targetDate ?? new Date();

        const events = await getEventsFn(workspaceId, targetDate);
        const text = formatReminderMessage(events, targetDate);

        if (userId) {
          await client.chat.postMessage({
            channel: userId,
            text,
          });
        }
      } catch (error) {
        logger.error(error);
        const userId = body?.user?.id;
        if (userId && client?.chat?.postMessage) {
          try {
            await client.chat.postMessage({
              channel: userId,
              text: `⚠️ 予定の取得中にエラーが発生しました: ${error.message}`,
            });
          } catch (notifyError) {
            logger.error(notifyError);
          }
        }
      }
    });
  }
}

/**
 * OAuth インストール成功時にインストールしたユーザー宛てへ初期設定案内 DM を送信する（案2）
 * 送信に失敗しても OAuth インストール完了フロー自体は止めないよう例外を隔離する
 *
 * @param {object} params - 送信パラメータ
 * @param {object} params.installation - Slack OAuth インストール結果
 * @param {string} params.appName - アプリ識別名
 * @param {Function} [params.fetchFn=fetch] - DI用 fetch 関数
 */
export async function sendWelcomeSetupDm({ installation, appName, fetchFn = fetch }) {
  const botToken = installation?.bot?.token;
  const userId = installation?.user?.id;

  if (!botToken || !userId) {
    return;
  }

  try {
    const response = await fetchFn('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: userId,
        text: `${appName} のインストールありがとうございます！下のボタンから初期設定を行ってください。`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎉 *${appName}* のインストールありがとうございます！\n最初に連携する Google カレンダーの設定を行いましょう。下のボタンまたはアプリの「ホーム」タブからいつでも設定・確認できます。`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '⚙️ 初期設定をはじめる',
                  emoji: true,
                },
                style: 'primary',
                action_id: ACTION_OPEN_SETTINGS,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`Welcome DM failed (${appName}): HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`Welcome DM skipped (${appName}):`, error.message);
  }
}
