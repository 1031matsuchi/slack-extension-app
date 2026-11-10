import { App, LogLevel } from '@slack/bolt';
import { registerListeners } from './listeners/index.js';

const isValidToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const trimmed = token.trim();
  if (!trimmed || trimmed.startsWith('YOUR_') || trimmed.includes('YOUR_')) {
    return false;
  }
  return true;
};

export const initApp = (env = process.env, options = {}) => {
  const botToken = env.APP_TEST_YOCHIPEN_BOT_TOKEN;
  const appToken = env.APP_TEST_YOCHIPEN_APP_TOKEN;

  if (!isValidToken(botToken) || !isValidToken(appToken)) {
    return null;
  }

  const app = new App({
    token: botToken,
    socketMode: true,
    appToken,
    logLevel: LogLevel.DEBUG,
    tokenVerificationEnabled: env.NODE_ENV !== 'test',
    clientOptions: {
      slackApiUrl: env.SLACK_API_URL,
    },
    ...options,
  });

  registerListeners(app);
  return app;
};
