/**
 * /pallot コマンドで受け取った文字列を、そのまま実行者に返します。
 * Slackのコマンド応答は短時間でackする必要があるため、先にackしてから返信します。
 */
const pallotCommandCallback = async ({ ack, command, respond, logger }) => {
  try {
    await ack();

    // コマンド引数が空の場合は、入力方法を案内します。
    const message = command.text ?? '';
    if (!message.trim()) {
      await respond('文字列を入力してください。例: /pallot こんにちは');
      return;
    }

    // 入力された文字列を加工せずに返します。
    await respond(message);
  } catch (error) {
    logger.error(error);
  }
};

export { pallotCommandCallback };
