import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createRequestHandler } from '../app.js';

const createMockRes = () => ({
  statusCode: 0,
  headers: {},
  headersSent: false,
  body: '',
  writeHead(status, headers) {
    this.statusCode = status;
    this.headers = headers;
    this.headersSent = true;
  },
  end(chunk) {
    this.body = chunk;
  },
});

describe('app.js createRequestHandler', () => {
  it('should respond 200 JSON on GET / health check', async () => {
    const handler = createRequestHandler(() => [{ name: 'message-calendar-bot', mode: 'oauth' }]);
    const res = createMockRes();

    await handler({ method: 'GET', url: '/', headers: { host: 'localhost:3000' } }, res);

    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.status, 'ok');
    assert.deepEqual(data.apps, [{ name: 'message-calendar-bot', mode: 'oauth' }]);
  });

  it('should delegate POST /cron/remind to cronHandler', async () => {
    const cronMock = mock.fn(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    const handler = createRequestHandler(() => [], { cronHandler: cronMock });
    const res = createMockRes();

    await handler({ method: 'POST', url: '/cron/remind', headers: { host: 'localhost:3000' } }, res);

    assert.strictEqual(cronMock.mock.callCount(), 1);
    assert.strictEqual(res.statusCode, 200);
  });

  it('should route /slack/<appName>/install to matching OAuth app receiver', async () => {
    const requestListenerMock = mock.fn((_req, res) => {
      res.writeHead(302, { Location: 'https://slack.com/oauth/v2/authorize' });
      res.end();
    });
    const handler = createRequestHandler(() => [
      {
        name: 'excel-calendar-bot',
        mode: 'oauth',
        receiver: { requestListener: requestListenerMock },
      },
    ]);
    const res = createMockRes();

    await handler(
      { method: 'GET', url: '/slack/excel-calendar-bot/install', headers: { host: 'localhost:3000' } },
      res,
    );

    assert.strictEqual(requestListenerMock.mock.callCount(), 1);
    assert.strictEqual(res.statusCode, 302);
  });

  it('should return 404 for unknown path or unloaded Slack app', async () => {
    const handler = createRequestHandler(() => []);
    const res = createMockRes();

    await handler({ method: 'GET', url: '/slack/unknown-bot/install', headers: { host: 'localhost:3000' } }, res);

    assert.strictEqual(res.statusCode, 404);
  });
});
