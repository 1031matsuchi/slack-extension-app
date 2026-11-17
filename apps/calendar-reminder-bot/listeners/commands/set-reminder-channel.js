import { upsertWorkspaceCalendarConfig } from '../../../../lib/google-calendar.js';

/**
 * /set-reminder-channel コマンドを実行したチャンネルをリマインド通知先として登録する
 *
 * @param {object} args - Slack Bolt コマンドハンドラー引数
 * @param {object} args.command - コマンドペイロード
 * @param {Function} args.ack - Slack への応答確認関数
 * @param {Function} args.respond - コマンド実行者への返信関数
 * @param {object} args.logger - ロガー
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export const setReminderChannelCallback = async ({ command, ack, respond, logger }, options = {}) => {
  try {
    await ack();

    // 入口で Slack の team_id を workspaceId として受け取る
    const workspaceId = command?.team_id;
    const channelId = command?.channel_id;

    if (!workspaceId || !channelId) {
      await respond({
        response_type: 'ephemeral',
        text: 'ワークスペースIDまたはチャンネルIDを取得できませんでした。チャンネル内で再度実行してください。',
      });
      return;
    }

    const saveConfig = options.upsertWorkspaceCalendarConfig ?? upsertWorkspaceCalendarConfig;
    await saveConfig(workspaceId, {
      reminderChannelId: channelId,
      updatedByUserId: command.user_id,
    });

    await respond({
      response_type: 'in_channel',
      text: `🔔 このチャンネル（<#${channelId}>）を毎日の予定リマインド通知先に設定しました。`,
    });
  } catch (error) {
    logger.error(error);
  }
};
