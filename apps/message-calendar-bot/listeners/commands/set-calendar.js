import { upsertWorkspaceCalendarConfig } from '../../../../lib/google-calendar.js';

/**
 * /set-calendar スラッシュコマンドを受け取り、ワークスペースと Google カレンダー ID を紐付ける
 * Slack の 3秒タイムアウトを防ぐため、try ブロックの冒頭で必ず await ack() を実行する
 *
 * @param {object} args - Slack Bolt コマンドハンドラー引数
 * @param {object} args.command - コマンドペイロード
 * @param {Function} args.ack - Slack への応答確認関数
 * @param {Function} args.respond - コマンド実行者への返信関数
 * @param {object} args.logger - ロガー
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export const setCalendarCallback = async ({ command, ack, respond, logger }, options = {}) => {
  try {
    // 3秒以内に Slack へ受付完了を通知する
    await ack();

    const calendarId = command?.text?.trim();
    // 入口で Slack の team_id を workspaceId として受け取る
    const workspaceId = command?.team_id;

    if (!calendarId) {
      await respond({
        response_type: 'ephemeral',
        text: '使い方: `/set-calendar <GoogleカレンダーID>`\n例: `/set-calendar example@group.calendar.google.com`\n※ 事前に Google カレンダーの共有設定でサービスアカウントへ編集権限を付与してください。',
      });
      return;
    }

    const saveConfig = options.upsertWorkspaceCalendarConfig ?? upsertWorkspaceCalendarConfig;
    await saveConfig(workspaceId, {
      googleCalendarId: calendarId,
      updatedByUserId: command.user_id,
    });

    await respond({
      response_type: 'ephemeral',
      text: `✅ このワークスペースの連携先 Google カレンダーを \`${calendarId}\` に設定しました。`,
    });
  } catch (error) {
    logger.error(error);
  }
};
