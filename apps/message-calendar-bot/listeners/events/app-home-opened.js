export const appHomeOpenedCallback = async ({ event, client, logger }) => {
  try {
    if (event.tab !== 'home') {
      return;
    }
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Welcome to message-calendar-bot!',
            },
          },
        ],
      },
    });
  } catch (error) {
    logger.error(error);
  }
};
