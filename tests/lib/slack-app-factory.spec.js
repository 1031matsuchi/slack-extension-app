import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createMultiModeSlackApp } from '../../lib/slack-app-factory.js';

describe('slack-app-factory', () => {
  it('should return null when neither OAuth nor Socket Mode credentials are configured', () => {
    const app = createMultiModeSlackApp(
      {
        appName: 'message-calendar-bot',
        scopes: ['chat:write'],
        registerListeners: mock.fn(),
      },
      {},
    );
    assert.strictEqual(app, null);
  });

  it('should initialize app in oauth mode when CLIENT_ID/CLIENT_SECRET/SIGNING_SECRET are set', () => {
    const registerMock = mock.fn();
    const fakeStore = {
      storeInstallation: mock.fn(),
      fetchInstallation: mock.fn(),
      deleteInstallation: mock.fn(),
    };

    const app = createMultiModeSlackApp(
      {
        appName: 'message-calendar-bot',
        scopes: ['chat:write', 'commands'],
        registerListeners: registerMock,
      },
      {
        NODE_ENV: 'test',
        MESSAGE_CALENDAR_BOT_CLIENT_ID: '123.456',
        MESSAGE_CALENDAR_BOT_CLIENT_SECRET: 'secret-value',
        MESSAGE_CALENDAR_BOT_SIGNING_SECRET: 'signing-secret',
        MESSAGE_CALENDAR_BOT_STATE_SECRET: 'state-secret',
      },
      { installationStore: fakeStore },
    );

    assert.ok(app);
    assert.strictEqual(app.name, 'message-calendar-bot');
    assert.strictEqual(app.mode, 'oauth');
    assert.strictEqual(typeof app.receiver?.requestListener, 'function');
    assert.strictEqual(registerMock.mock.callCount(), 1);
  });

  it('should initialize app in socket mode when BOT_TOKEN/APP_TOKEN are set', () => {
    const registerMock = mock.fn();

    const app = createMultiModeSlackApp(
      {
        appName: 'excel-calendar-bot',
        scopes: ['chat:write'],
        registerListeners: registerMock,
      },
      {
        NODE_ENV: 'test',
        EXCEL_CALENDAR_BOT_BOT_TOKEN: 'xoxb-test',
        EXCEL_CALENDAR_BOT_APP_TOKEN: 'xapp-test',
      },
    );

    assert.ok(app);
    assert.strictEqual(app.name, 'excel-calendar-bot');
    assert.strictEqual(app.mode, 'socket');
    assert.strictEqual(registerMock.mock.callCount(), 1);
  });
});
