import { getUpcomingEvents } from '../../../../lib/google-calendar.js';
import { formatReminderMessage } from '../../services/reminder-service.js';

/**
 * /check-today スラッシュコマンドで本日の Google カレンダー予定を即時確認する
 *
 * @param {object} args - Slack Bolt コマンドハンドラー引数
 * @param {object} args.command - コマンドペイロード
 * @param {Function} args.ack - Slack への応答確認関数
 * @param {Function} args.respond - コマンド実行者への返信関数
 * @param {object} args.logger - ロガー
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export const checkTodayCallback = async ({ command, ack, respond, logger }, options = {}) => {
  try {
    await ack();

    // 入口で Slack の team_id を workspaceId として受け取る
    const workspaceId = command?.team_id;
    const targetDate = options.targetDate ?? new Date();
    const fetchEvents = options.getUpcomingEvents ?? getUpcomingEvents;

    const events = await fetchEvents(workspaceId, targetDate);
    const text = formatReminderMessage(events, targetDate);

    await respond({
      response_type: 'ephemeral',
      text,
    });
  } catch (error) {
    logger.error(error);
    try {
      await respond({
        response_type: 'ephemeral',
        text: `⚠️ 予定の取得中にエラーが発生しました: ${error.message}`,
      });
    } catch (notifyError) {
      logger.error(notifyError);
    }
  }
};
