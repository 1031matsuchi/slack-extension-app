import { parseYearlyEventsFromExcel } from '../../../../lib/gemini.js';
import { insertBatchEvents } from '../../../../lib/google-calendar.js';
import { downloadAndParseExcel } from '../../services/excel-parser.js';

const EXCEL_EXT_PATTERN = /\.(xlsx|xls)$/i;

/**
 * file_shared イベントを受け取り、Excel ファイルから年間予定を抽出して一括登録する
 * 他 Bot への影響を隔離するため、全体を try...catch で保護している
 *
 * @param {object} args - Slack Bolt イベントハンドラー引数
 * @param {object} args.event - file_shared イベントペイロード
 * @param {object} [args.body] - リクエストボディ全体
 * @param {object} [args.context] - コンテキスト情報（teamId, botToken 等）
 * @param {object} args.client - Slack Web API クライアント
 * @param {object} args.logger - ロガー
 * @param {object} [options={}] - テスト時の DI 用オプション
 */
export const fileSharedCallback = async ({ event, body, context, client, logger }, options = {}) => {
  const channel = event?.channel_id;

  try {
    const fileId = event?.file_id;
    // 入口で Slack の teamId を workspaceId として受け取る
    const workspaceId = context?.teamId ?? body?.team_id;
    const botToken = context?.botToken ?? options.botToken;

    if (!fileId || !channel || !workspaceId) {
      logger.warn('file_shared: 必要な識別子（file_id / channel_id / workspaceId）が不足しています。');
      return;
    }

    const fileInfoResult = await client.files.info({ file: fileId });
    const file = fileInfoResult?.file;
    if (!file?.name || !EXCEL_EXT_PATTERN.test(file.name)) {
      // Excel ファイル以外は対象外として静かにスキップする
      return;
    }

    const downloadFn = options.downloadAndParseExcel ?? downloadAndParseExcel;
    const parseEventsFn = options.parseYearlyEventsFromExcel ?? parseYearlyEventsFromExcel;
    const insertBatchFn = options.insertBatchEvents ?? insertBatchEvents;

    const sheetRows = await downloadFn(file.url_private_download, botToken);
    if (!sheetRows || sheetRows.length === 0) {
      await client.chat.postMessage({
        channel,
        text: `📄 \`${file.name}\` に読み取れる行データが見つかりませんでした。`,
      });
      return;
    }

    const currentYear = new Date().getFullYear();
    const events = await parseEventsFn(sheetRows, currentYear);

    if (!events || events.length === 0) {
      await client.chat.postMessage({
        channel,
        text: `📄 \`${file.name}\` からカレンダーに登録できる予定が見つかりませんでした。`,
      });
      return;
    }

    const summary = await insertBatchFn(workspaceId, events);
    const errorNote =
      summary.failed > 0 ? `\n⚠️ 一部登録に失敗しました (${summary.failed}件): ${summary.errors[0]?.message ?? ''}` : '';

    await client.chat.postMessage({
      channel,
      text: `📊 \`${file.name}\` の年間予定を取り込みました！\n• *対象件数*: ${summary.total}件\n• *登録成功*: ${summary.succeeded}件\n• *失敗*: ${summary.failed}件${errorNote}`,
    });
  } catch (error) {
    logger.error(error);
    if (channel && client?.chat?.postMessage) {
      try {
        await client.chat.postMessage({
          channel,
          text: `⚠️ Excel 予定の取り込み中にエラーが発生しました: ${error.message}`,
        });
      } catch (notifyError) {
        logger.error(notifyError);
      }
    }
  }
};
