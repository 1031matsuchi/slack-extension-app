import { extractEventFromMessage } from '../../../../lib/gemini.js';
import { insertEvent } from '../../../../lib/google-calendar.js';

// カレンダー登録のトリガーとして扱う Slack リアクション名（📅）
const TARGET_REACTIONS = new Set(['calendar', 'spiral_calendar_pad']);

/**
 * reaction_added イベントを受け取り、メッセージから予定を抽出して Google カレンダーへ登録する
 * 相乗り環境で他 Bot を巻き込んで停止しないよう、全体を try...catch で保護している
 *
 * @param {object} args - Slack Bolt イベントハンドラー引数
 * @param {object} args.event - reaction_added イベントペイロード
 * @param {object} [args.body] - リクエストボディ全体
 * @param {object} [args.context] - コンテキスト情報（teamId 等）
 * @param {object} args.client - Slack Web API クライアント
 * @param {object} args.logger - ロガー
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export const reactionAddedCallback = async ({ event, body, context, client, logger }, options = {}) => {
  try {
    // メッセージ以外のリアクションや、対象外のスタンプは無視する
    if (event?.item?.type !== 'message' || !TARGET_REACTIONS.has(event?.reaction)) {
      return;
    }

    const channel = event.item.channel;
    const messageTs = event.item.ts;
    // Slack 内部の teamId を入口で受け取り、以降は workspaceId として扱う
    const workspaceId = context?.teamId ?? body?.team_id;

    if (!workspaceId || !channel || !messageTs) {
      logger.warn('reaction_added: 必要な識別子（workspaceId / channel / ts）が不足しています。');
      return;
    }

    // リアクションが付いた元メッセージの本文を取得する
    const historyResult = await client.conversations.history({
      channel,
      latest: messageTs,
      inclusive: true,
      limit: 1,
    });

    const targetMessage = historyResult?.messages?.[0];
    if (!targetMessage?.text) {
      return;
    }

    const extractFn = options.extractEventFromMessage ?? extractEventFromMessage;
    const insertFn = options.insertEvent ?? insertEvent;

    // Gemini API でメッセージ本文から予定情報を抽出する
    const extracted = await extractFn(targetMessage.text);
    if (!extracted?.hasEvent) {
      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: 'メッセージから登録可能な予定が見つかりませんでした。日付や内容を含めて再度お試しください。',
      });
      return;
    }

    // ワークスペースに紐づく Google カレンダーへ予定を登録する
    const created = await insertFn(workspaceId, extracted);
    const whenText = extracted.allDay ? `${extracted.date}（終日）` : extracted.startDateTime;
    const linkLine = created?.htmlLink ? `\n<${created.htmlLink}|Googleカレンダーで確認>` : '';

    await client.chat.postMessage({
      channel,
      thread_ts: messageTs,
      text: `📅 Googleカレンダーに予定を登録しました！\n• *タイトル*: ${extracted.title}\n• *日時*: ${whenText}${linkLine}`,
    });
  } catch (error) {
    logger.error(error);
    // 可能であればユーザーにもエラー内容をスレッドで通知する
    const channel = event?.item?.channel;
    const messageTs = event?.item?.ts;
    if (channel && messageTs && client?.chat?.postMessage) {
      try {
        await client.chat.postMessage({
          channel,
          thread_ts: messageTs,
          text: `⚠️ 予定の登録中にエラーが発生しました: ${error.message}`,
        });
      } catch (notifyError) {
        logger.error(notifyError);
      }
    }
  }
};
