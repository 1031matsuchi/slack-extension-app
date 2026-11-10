import assert from 'node:assert';
import { describe, it } from 'node:test';
import { loadAllApps } from '../../apps/index.js';
import { initApp } from '../../apps/sample-slack-app/index.js';

describe('sample-slack-app initApp', () => {
  it('should return null when tokens are missing', () => {
    const result = initApp({ NODE_ENV: 'test' });
    assert.strictEqual(result, null);
  });

  it('should return null when tokens are placeholder values', () => {
    const result = initApp({
      NODE_ENV: 'test',
      SAMPLE_SLACK_APP_BOT_TOKEN: 'YOUR_SAMPLE_SLACK_APP_BOT_TOKEN',
      SAMPLE_SLACK_APP_APP_TOKEN: 'YOUR_SAMPLE_SLACK_APP_APP_TOKEN',
    });
    assert.strictEqual(result, null);
  });

  it('should return null when bot token is placeholder even with generic token placeholder', () => {
    const result = initApp({
      NODE_ENV: 'test',
      SLACK_BOT_TOKEN: 'YOUR_SLACK_BOT_TOKEN',
      SLACK_APP_TOKEN: 'YOUR_SLACK_APP_TOKEN',
    });
    assert.strictEqual(result, null);
  });

  it('should return App instance when valid tokens are provided via SAMPLE_SLACK_APP env', () => {
    const result = initApp({
      NODE_ENV: 'test',
      SAMPLE_SLACK_APP_BOT_TOKEN: 'xoxb-valid-test-token',
      SAMPLE_SLACK_APP_APP_TOKEN: 'xapp-valid-test-token',
    });
    assert.ok(result);
    assert.strictEqual(result.name, 'sample-slack-app');
  });

  it('should return App instance when valid tokens are provided via SLACK env fallback', () => {
    const result = initApp({
      NODE_ENV: 'test',
      SLACK_BOT_TOKEN: 'xoxb-valid-slack-token',
      SLACK_APP_TOKEN: 'xapp-valid-slack-token',
    });
    assert.ok(result);
    assert.strictEqual(result.name, 'sample-slack-app');
  });

  it('should prioritize valid SAMPLE_SLACK_APP token over SLACK token', () => {
    const result = initApp({
      NODE_ENV: 'test',
      SAMPLE_SLACK_APP_BOT_TOKEN: 'YOUR_PLACEHOLDER',
      SLACK_BOT_TOKEN: 'xoxb-fallback-token',
      SLACK_APP_TOKEN: 'xapp-fallback-token',
    });
    assert.ok(result);
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
      SAMPLE_SLACK_APP_BOT_TOKEN: 'xoxb-valid-test-token',
      SAMPLE_SLACK_APP_APP_TOKEN: 'xapp-valid-test-token',
    });
    assert.strictEqual(apps.length, 1);
    assert.strictEqual(apps[0].name, 'sample-slack-app');
  });
});
