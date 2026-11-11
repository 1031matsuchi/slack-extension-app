const sampleMessageCallback = async ({ context, say, logger }) => {
  try {
    const palloting = context.matches[0];
    await say(`${palloting}, how are you?`);
  } catch (error) {
    logger.error(error);
  }
};

export { sampleMessageCallback };
