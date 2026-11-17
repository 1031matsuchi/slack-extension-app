import { createMultiModeSlackApp } from '../../lib/slack-app-factory.js';
import { registerListeners } from './listeners/index.js';

const APP_NAME = 'excel-calendar-bot';
const SCOPES = ['files:read', 'channels:history', 'groups:history', 'chat:write', 'commands'];

/**
 * excel-calendar-bot を初期化する（OAuth 配布モード / Socket Mode 両対応）
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @param {object} [options={}] - テスト・拡張用オプション
 */
export const initApp = (env = process.env, options = {}) =>
  createMultiModeSlackApp({ appName: APP_NAME, scopes: SCOPES, registerListeners }, env, options);
