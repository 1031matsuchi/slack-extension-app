import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');

const createIndexContent = (prefix) => `import { App, LogLevel } from '@slack/bolt';
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
  const botToken = env.${prefix}_BOT_TOKEN;
  const appToken = env.${prefix}_APP_TOKEN;

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
`;

const createManifestContent = (appName) => `{
  "_metadata": {
    "major_version": 1,
    "minor_version": 1
  },
  "display_information": {
    "name": "${appName}"
  },
  "features": {
    "app_home": {
      "home_tab_enabled": true,
      "messages_tab_enabled": false,
      "messages_tab_read_only_enabled": true
    },
    "bot_user": {
      "display_name": "${appName}",
      "always_online": true
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": ["channels:history", "chat:write"]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": ["app_home_opened", "message.channels"]
    },
    "interactivity": {
      "is_enabled": true
    },
    "org_deploy_enabled": true,
    "socket_mode_enabled": true,
    "token_rotation_enabled": false
  }
}
`;

const createListenersIndexContent = () => `import * as events from './events/index.js';
import * as messages from './messages/index.js';

export const registerListeners = (app) => {
  events.register(app);
  messages.register(app);
};
`;

const createEventsIndexContent = () => `import { appHomeOpenedCallback } from './app-home-opened.js';

export const register = (app) => {
  app.event('app_home_opened', appHomeOpenedCallback);
};
`;

const createAppHomeOpenedContent = (
  appName,
) => `export const appHomeOpenedCallback = async ({ event, client, logger }) => {
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
              text: 'Welcome to ${appName}!',
            },
          },
        ],
      },
    });
  } catch (error) {
    logger.error(error);
  }
};
`;

const createMessagesIndexContent = () => `import { sampleMessageCallback } from './sample-message.js';

export const register = (app) => {
  app.message(/^(hi|hello|hey).*/i, sampleMessageCallback);
};
`;

const createSampleMessageContent = () => `export const sampleMessageCallback = async ({ context, say, logger }) => {
  try {
    const greeting = context.matches[0];
    await say(\`\${greeting}, how are you?\`);
  } catch (error) {
    logger.error(error);
  }
};
`;

const updateEnvFile = async (filePath, lines, prefix) => {
  if (existsSync(filePath)) {
    const content = await readFile(filePath, 'utf8');
    if (!content.includes(`${prefix}_BOT_TOKEN`)) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      await appendFile(filePath, `${separator}${lines}`);
    }
  } else {
    await writeFile(filePath, lines);
  }
};

export const createApp = async (appName, options = {}) => {
  const targetRootDir = options.rootDir || rootDir;
  const appDir = path.join(targetRootDir, 'apps', appName);

  if (existsSync(appDir)) {
    throw new Error(`App "${appName}" already exists at ${appDir}`);
  }

  const prefix = appName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const eventsDir = path.join(appDir, 'listeners', 'events');
  const messagesDir = path.join(appDir, 'listeners', 'messages');

  await mkdir(eventsDir, { recursive: true });
  await mkdir(messagesDir, { recursive: true });

  await writeFile(path.join(appDir, 'index.js'), createIndexContent(prefix));
  await writeFile(path.join(appDir, 'manifest.json'), createManifestContent(appName));
  await writeFile(path.join(appDir, 'listeners', 'index.js'), createListenersIndexContent());
  await writeFile(path.join(eventsDir, 'index.js'), createEventsIndexContent());
  await writeFile(path.join(eventsDir, 'app-home-opened.js'), createAppHomeOpenedContent(appName));
  await writeFile(path.join(messagesDir, 'index.js'), createMessagesIndexContent());
  await writeFile(path.join(messagesDir, 'sample-message.js'), createSampleMessageContent());

  const tokenLines = `${prefix}_BOT_TOKEN=YOUR_${prefix}_BOT_TOKEN\n${prefix}_APP_TOKEN=YOUR_${prefix}_APP_TOKEN\n`;
  await updateEnvFile(path.join(targetRootDir, '.env.sample'), tokenLines, prefix);
  await updateEnvFile(path.join(targetRootDir, '.env'), tokenLines, prefix);

  console.log(`Successfully created app "${appName}" in apps/${appName}`);
  console.log(`Updated environment variables with ${prefix}_BOT_TOKEN and ${prefix}_APP_TOKEN`);
};

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const appName = args[0];

  if (!appName) {
    console.error('Error: App name is required. Usage: npm run create:app <app-name>');
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(appName)) {
    console.error('Error: App name must contain only letters, numbers, hyphens, and underscores.');
    process.exit(1);
  }

  try {
    await createApp(appName);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
