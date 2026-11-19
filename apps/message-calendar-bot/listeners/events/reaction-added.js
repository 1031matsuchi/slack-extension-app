/**
 * reaction_added イベントの最小骨組みハンドラー
 * 要件定義の確定後に、メッセージ取得・Gemini 抽出・Google カレンダー登録の具体的な処理を接続する
 * 相乗り環境で他 Bot を巻き込んで停止しないよう、全体を try...catch で保護している
 *
 * @param {object} args - Slack Bolt イベントハンドラー引数
 * @param {object} args.event - reaction_added イベントペイロード
 * @param {object} [args.body] - リクエストボディ全体
 * @param {object} [args.context] - コンテキスト情報（teamId 等）
 * @param {object} args.logger - ロガー
 */
export const reactionAddedCallback = async ({ event, body, context, logger }) => {
  try {
    if (event?.item?.type !== 'message') {
      return;
    }

    // 入口で Slack 内部の teamId を workspaceId として受け取る
    const workspaceId = context?.teamId ?? body?.team_id;
    const channel = event.item.channel;
    const messageTs = event.item.ts;

    if (!workspaceId || !channel || !messageTs) {
      logger.warn('reaction_added: 必要な識別子（workspaceId / channel / ts）が不足しています。');
    }
  } catch (error) {
    logger.error(error);
  }
};
