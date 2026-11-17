import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { handleCronRemindRequest } from '../../routes/cron.js';

const createMockRes = () => {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk;
    },
  };
  return res;
};

describe('routes/cron handleCronRemindRequest', () => {
  it('should return 503 when CRON_SECRET is not configured', async () => {
    const res = createMockRes();
    await handleCronRemindRequest({ headers: {} }, res, { env: {} });

    assert.strictEqual(res.statusCode, 503);
  });

  it('should return 401 when authorization header does not match CRON_SECRET', async () => {
    const res = createMockRes();
    await handleCronRemindRequest({ headers: { authorization: 'Bearer wrong-secret' } }, res, {
      env: { CRON_SECRET: 'super-secret' },
    });

    assert.strictEqual(res.statusCode, 401);
  });

  it('should execute sendDailyReminders and return 200 when Bearer token is valid', async () => {
    const res = createMockRes();
    const sendRemindersMock = mock.fn(async () => ({
      total: 2,
      succeeded: 2,
      failed: 0,
      errors: [],
    }));

    await handleCronRemindRequest({ headers: { authorization: 'Bearer super-secret' } }, res, {
      env: { CRON_SECRET: 'super-secret' },
      prismaClient: {},
      sendDailyReminders: sendRemindersMock,
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(sendRemindersMock.mock.callCount(), 1);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.status, 'ok');
    assert.strictEqual(parsed.summary.succeeded, 2);
  });

  it('should return 500 when sendDailyReminders throws an exception', async () => {
    const res = createMockRes();
    const sendRemindersMock = mock.fn(async () => {
      throw new Error('DB connection error');
    });

    await handleCronRemindRequest({ headers: { 'x-cron-secret': 'super-secret' } }, res, {
      env: { CRON_SECRET: 'super-secret' },
      prismaClient: {},
      sendDailyReminders: sendRemindersMock,
    });

    assert.strictEqual(res.statusCode, 500);
    const parsed = JSON.parse(res.body);
    assert(parsed.error.includes('DB connection error'));
  });
});
