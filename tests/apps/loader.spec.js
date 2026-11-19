import assert from 'node:assert';
import { describe, it } from 'node:test';
import { loadAllApps } from '../../apps/index.js';
import { initApp } from '../../apps/message-calendar-bot/index.js';

describe('message-calendar-bot initApp', () => {
  it('should return null when tokens are missing', () => {
    const result = initApp({ NODE_ENV: 'test' });
    assert.strictEqual(result, null);
  });

  it('should return null when tokens are placeholder values', () => {
    const result = initApp({
      NODE_ENV: 'test',
      MESSAGE_CALENDAR_BOT_BOT_TOKEN: 'YOUR_MESSAGE_CALENDAR_BOT_BOT_TOKEN',
      MESSAGE_CALENDAR_BOT_APP_TOKEN: 'YOUR_MESSAGE_CALENDAR_BOT_APP_TOKEN',
    });
    assert.strictEqual(result, null);
  });

  it('should return App instance when valid Socket Mode tokens are provided', () => {
    const result = initApp({
      NODE_ENV: 'test',
      MESSAGE_CALENDAR_BOT_BOT_TOKEN: 'xoxb-valid-test-token',
      MESSAGE_CALENDAR_BOT_APP_TOKEN: 'xapp-valid-test-token',
    });
    assert.ok(result);
    assert.strictEqual(result.name, 'message-calendar-bot');
  });
});

describe('apps loader loadAllApps', () => {
  it('should return an array', async () => {
    const apps = await loadAllApps({ NODE_ENV: 'test' });
    assert.ok(Array.isArray(apps));
    assert.strictEqual(apps.length, 0);
  });

  it('should load configured app when valid tokens are passed', async () => {
    const apps = await loadAllApps({
      NODE_ENV: 'test',
      MESSAGE_CALENDAR_BOT_BOT_TOKEN: 'xoxb-valid-test-token',
      MESSAGE_CALENDAR_BOT_APP_TOKEN: 'xapp-valid-test-token',
    });
    assert.strictEqual(apps.length, 1);
    assert.strictEqual(apps[0].name, 'message-calendar-bot');
  });
});
