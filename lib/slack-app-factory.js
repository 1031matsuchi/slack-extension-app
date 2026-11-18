import { App, HTTPReceiver, LogLevel } from '@slack/bolt';
import { defaultCallbackSuccess } from '@slack/oauth';
import { createPrismaInstallationStore } from './slack-installation-store.js';
import { sendWelcomeSetupDm } from './slack-setup-ui.js';

/**
 * 設定値が有効（未設定・空文字・YOUR_ プレースホルダーでない）か判定する
 *
 * @param {string | undefined} value - 検証対象の環境変数値
 * @returns {boolean} 有効な値であれば true
 */
export const isValidConfigValue = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('YOUR_')) {
    return false;
  }
  return true;
};

/**
 * ケバブケースのアプリ名を環境変数プレフィックス（大文字スネークケース）へ変換する
 * 例: 'message-calendar-bot' -> 'MESSAGE_CALENDAR_BOT'
 *
 * @param {string} appName - アプリ名
 * @returns {string} 環境変数プレフィックス
 */
const toEnvPrefix = (appName) => appName.trim().replace(/-/g, '_').toUpperCase();

/**
 * 本格配布（OAuth 2.0 + HTTPReceiver）またはローカル開発（Socket Mode）の両対応で Bolt App を初期化する
 * 必要な環境変数が未設定またはプレースホルダーの場合は null を返し、他 Bot への影響を隔離する
 *
 * @param {object} config - アプリ初期化設定
 * @param {string} config.appName - アプリ識別名（例: 'message-calendar-bot'）
 * @param {Array<string>} config.scopes - Bot に必要な OAuth スコープ配列
 * @param {Function} config.registerListeners - リスナー登録関数
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @param {object} [options={}] - テスト・拡張用オプション（installationStore 等）
 * @returns {App & { mode?: 'oauth' | 'socket', name?: string } | null}
 */
export function createMultiModeSlackApp({ appName, scopes, registerListeners }, env = process.env, options = {}) {
  const prefix = toEnvPrefix(appName);

  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  const signingSecret = env[`${prefix}_SIGNING_SECRET`];
  const stateSecret = env[`${prefix}_STATE_SECRET`] || 'default-state-secret-change-me';

  // 1. OAuth 認証情報が揃っている場合は本番配布モード（HTTPReceiver）で初期化する
  if (isValidConfigValue(clientId) && isValidConfigValue(clientSecret) && isValidConfigValue(signingSecret)) {
    const installationStore = options.installationStore ?? createPrismaInstallationStore(appName);

    const receiver = new HTTPReceiver({
      signingSecret: signingSecret.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      stateSecret: stateSecret.trim(),
      scopes,
      installationStore,
      endpoints: `/slack/${appName}/events`,
      installPath: `/slack/${appName}/install`,
      installRedirectUriPath: `/slack/${appName}/oauth_redirect`,
      installerOptions: {
        directInstall: true,
        callbackOptions: {
          // OAuth インストール完了直後に案内 DM を送信してから通常の完了画面を返す
          success: async (installation, installOptions, req, res) => {
            await sendWelcomeSetupDm({ installation, appName });
            defaultCallbackSuccess(installation, installOptions, req, res);
          },
        },
      },
      ...(options.receiverOptions ?? {}),
    });

    const app = new App({
      receiver,
      logLevel: LogLevel.INFO,
      tokenVerificationEnabled: env.NODE_ENV !== 'test',
      ...options.appOptions,
    });

    registerListeners(app);
    app.name = appName;
    app.mode = 'oauth';
    return app;
  }

  // 2. ローカル開発用の Socket Mode トークンが揃っている場合は Socket Mode で初期化する
  const botToken = env[`${prefix}_BOT_TOKEN`];
  const appToken = env[`${prefix}_APP_TOKEN`];

  if (isValidConfigValue(botToken) && isValidConfigValue(appToken)) {
    const app = new App({
      token: botToken.trim(),
      socketMode: true,
      appToken: appToken.trim(),
      logLevel: LogLevel.DEBUG,
      tokenVerificationEnabled: env.NODE_ENV !== 'test',
      clientOptions: {
        slackApiUrl: env.SLACK_API_URL,
      },
      ...options.appOptions,
    });

    registerListeners(app);
    app.name = appName;
    app.mode = 'socket';
    return app;
  }

  // 3. どちらの認証情報も未設定の場合は安全にスキップする
  return null;
}
