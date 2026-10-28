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

const resolveToken = (...tokens) => {
  for (const token of tokens) {
    if (isValidToken(token)) {
      return token;
    }
  }
  return null;
};

export const initApp = (env = process.env, options = {}) => {
  const botToken = resolveToken(env.MA_APP_01_BOT_TOKEN, env.SLACK_BOT_TOKEN);
  const appToken = resolveToken(env.MA_APP_01_APP_TOKEN, env.SLACK_APP_TOKEN);

  if (!botToken || !appToken) {
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
  app.name = 'ma-app-01';
  return app;
};
