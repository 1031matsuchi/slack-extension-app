import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { loadAllApps } from './apps/index.js';
import { handleCronRemindRequest } from './routes/cron.js';

config();

const port = process.env.PORT || 3000;

/**
 * ロードされた全 Slack Bot アプリを保持する配列（HTTP ルーティングから参照）
 * @type {Array<import('@slack/bolt').App & { name?: string, mode?: string }>}
 */
let loadedApps = [];

/**
 * URL パス `/slack/<appName>/...` から対象のアプリ名を取り出す
 *
 * @param {string} pathname - リクエスト URL のパス部分
 * @returns {string | null} 抽出されたアプリ名、一致しない場合は null
 */
const extractSlackAppNameFromPath = (pathname) => {
  const match = /^\/slack\/([a-z0-9-]+)(?:\/|$)/.exec(pathname);
  return match ? match[1] : null;
};

/**
 * HTTP リクエストを受け付け、ヘルスチェック / Cron / 各アプリの OAuth & Events へ振り分けるハンドラーを生成する
 * 特定の Bot 名をハードコードせず、ロード済みアプリ一覧から動的にマッチングする
 *
 * @param {Function} [getApps=() => loadedApps] - 現在のロード済みアプリ一覧を返す関数
 * @param {object} [options={}] - テスト時の DI 用オプション（cronHandler 等）
 * @returns {Function} Node.js http.createServer 用のリクエストリスナー
 */
export const createRequestHandler = (getApps = () => loadedApps, options = {}) => {
  const cronHandler = options.cronHandler ?? handleCronRemindRequest;

  return async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
      const { pathname } = requestUrl;

      // 1. ヘルスチェック（Render 死活監視 / cron-job.org スリープ防止用）
      if (req.method === 'GET' && (pathname === '/' || pathname === '/health')) {
        const apps = getApps();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            apps: apps.map((app) => ({ name: app.name, mode: app.mode ?? 'socket' })),
          }),
        );
        return;
      }

      // 2. 定期リマインド配信用 Cron エンドポイント
      if (req.method === 'POST' && pathname === '/cron/remind') {
        await cronHandler(req, res);
        return;
      }

      // 3. 各アプリの OAuth インストール (/install, /oauth_redirect) およびイベント受信 (/events)
      const targetAppName = extractSlackAppNameFromPath(pathname);
      if (targetAppName) {
        const targetApp = getApps().find((app) => app.name === targetAppName);
        if (targetApp && typeof targetApp.receiver?.requestListener === 'function') {
          targetApp.receiver.requestListener(req, res);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (error) {
      console.error('Unhandled HTTP request error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
  };
};

export const server = http.createServer(createRequestHandler());

/**
 * apps/ 配下の全アプリをロードし、必要なもの（Socket Mode）を起動する
 * OAuth モード（HTTPReceiver）のアプリはメイン HTTP サーバーに相乗りするため app.start() は呼ばない
 * 1つのアプリの起動エラーが他アプリを止めないよう個別に try...catch で隔離する
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - 環境変数オブジェクト
 * @returns {Promise<Array>} ロードされたアプリ配列
 */
export const startApps = async (env = process.env) => {
  const apps = await loadAllApps(env);
  loadedApps = apps;

  if (apps.length === 0) {
    console.log('No Slack apps were loaded.');
  }

  await Promise.all(
    apps.map(async (app) => {
      try {
        if (app.mode === 'oauth') {
          console.log(`⚡️ Bolt app (${app.name}) mounted on HTTP OAuth router!`);
          return;
        }
        await app.start();
        console.log(`⚡️ Bolt app (${app.name}) is running!`);
      } catch (error) {
        console.error(`Failed to start app (${app.name}):`, error);
      }
    }),
  );

  return apps;
};

// テスト等から import された場合にポート競合や自動接続が起きないよう、直接実行時のみ起動する
const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  server.listen(port, () => {
    console.log(`Health check & OAuth server listening on port ${port}`);
  });
  startApps();
}
