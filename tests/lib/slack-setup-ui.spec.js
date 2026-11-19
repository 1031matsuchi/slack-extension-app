import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
  ACTION_CHECK_TODAY,
  ACTION_OPEN_SETTINGS,
  buildAppHomeView,
  buildSettingsModal,
  registerSetupUiListeners,
  sendWelcomeSetupDm,
  VIEW_SETTINGS_MODAL,
} from '../../lib/slack-setup-ui.js';

const createMockApp = () => {
  const handlers = {
    events: new Map(),
    actions: new Map(),
    views: new Map(),
  };
  return {
    handlers,
    event(name, fn) {
      handlers.events.set(name, fn);
    },
    action(id, fn) {
      handlers.actions.set(id, fn);
    },
    view(id, fn) {
      handlers.views.set(id, fn);
    },
  };
};

describe('slack-setup-ui', () => {
  let fakeClient;
  let fakeLogger;

  beforeEach(() => {
    fakeClient = {
      views: {
        publish: mock.fn(async () => ({ ok: true })),
        open: mock.fn(async () => ({ ok: true })),
      },
      chat: {
        postMessage: mock.fn(async () => ({ ok: true })),
      },
    };
    fakeLogger = {
      error: mock.fn(),
    };
  });

  it('should build App Home view with reminder button when includeReminderOptions is true', () => {
    const view = buildAppHomeView({
      appName: 'calendar-reminder-bot',
      userId: 'U123',
      config: { googleCalendarId: 'cal@gmail.com', reminderChannelId: 'C999' },
      serviceAccountEmail: 'bot@project.iam.gserviceaccount.com',
      includeReminderOptions: true,
    });

    assert.strictEqual(view.type, 'home');
    const serialized = JSON.stringify(view);
    assert(serialized.includes('cal@gmail.com'));
    assert(serialized.includes('<#C999>'));
    assert(serialized.includes('bot@project.iam.gserviceaccount.com'));
    assert(serialized.includes(ACTION_OPEN_SETTINGS));
    assert(serialized.includes(ACTION_CHECK_TODAY));
  });

  it('should build settings modal with channel selector only when includeReminderChannel is true', () => {
    const modalWithoutChannel = buildSettingsModal({ config: null, includeReminderChannel: false });
    assert.strictEqual(modalWithoutChannel.blocks.length, 1);

    const modalWithChannel = buildSettingsModal({
      config: { googleCalendarId: 'cal@gmail.com', reminderChannelId: 'C100' },
      includeReminderChannel: true,
    });
    assert.strictEqual(modalWithChannel.blocks.length, 2);
    assert.strictEqual(modalWithChannel.blocks[1].element.type, 'conversations_select');
    assert.strictEqual(modalWithChannel.blocks[1].element.initial_conversation, 'C100');
  });

  it('should publish Home view on app_home_opened event', async () => {
    const app = createMockApp();
    const getConfigMock = mock.fn(async () => ({ googleCalendarId: 'cal@gmail.com' }));

    registerSetupUiListeners(
      app,
      { appName: 'message-calendar-bot', includeReminderOptions: false },
      { getWorkspaceCalendarConfig: getConfigMock, env: { GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@example.com' } },
    );

    const handler = app.handlers.events.get('app_home_opened');
    await handler({
      event: { tab: 'home', user: 'U1' },
      context: { teamId: 'W1' },
      client: fakeClient,
      logger: fakeLogger,
    });

    assert.strictEqual(getConfigMock.mock.callCount(), 1);
    assert.strictEqual(fakeClient.views.publish.mock.callCount(), 1);
  });

  it('should ack and open settings modal on ACTION_OPEN_SETTINGS', async () => {
    const app = createMockApp();
    const ackMock = mock.fn(async () => {});
    const getConfigMock = mock.fn(async () => null);

    registerSetupUiListeners(
      app,
      { appName: 'message-calendar-bot', includeReminderOptions: false },
      { getWorkspaceCalendarConfig: getConfigMock },
    );

    const handler = app.handlers.actions.get(ACTION_OPEN_SETTINGS);
    await handler({
      ack: ackMock,
      body: { trigger_id: 'TRIG_1', team: { id: 'W2' } },
      context: { teamId: 'W2' },
      client: fakeClient,
      logger: fakeLogger,
    });

    assert.strictEqual(ackMock.mock.callCount(), 1);
    assert.strictEqual(fakeClient.views.open.mock.callCount(), 1);
    assert.strictEqual(fakeClient.views.open.mock.calls[0].arguments[0].trigger_id, 'TRIG_1');
  });

  it('should ack, save config, and refresh Home view on modal submit', async () => {
    const app = createMockApp();
    const ackMock = mock.fn(async () => {});
    const saveConfigMock = mock.fn(async () => ({}));
    const getConfigMock = mock.fn(async () => ({
      googleCalendarId: 'updated@gmail.com',
      reminderChannelId: 'C777',
    }));

    registerSetupUiListeners(
      app,
      { appName: 'calendar-reminder-bot', includeReminderOptions: true },
      { upsertWorkspaceCalendarConfig: saveConfigMock, getWorkspaceCalendarConfig: getConfigMock, env: {} },
    );

    const handler = app.handlers.views.get(VIEW_SETTINGS_MODAL);
    await handler({
      ack: ackMock,
      body: { team: { id: 'W3' }, user: { id: 'U3' } },
      context: { teamId: 'W3' },
      view: {
        state: {
          values: {
            calendar_id_block: { calendar_id_input: { value: 'updated@gmail.com' } },
            reminder_channel_block: { reminder_channel_select: { selected_conversation: 'C777' } },
          },
        },
      },
      client: fakeClient,
      logger: fakeLogger,
    });

    assert.strictEqual(ackMock.mock.callCount(), 1);
    assert.strictEqual(saveConfigMock.mock.callCount(), 1);
    assert.deepEqual(saveConfigMock.mock.calls[0].arguments[1], {
      googleCalendarId: 'updated@gmail.com',
      updatedByUserId: 'U3',
      reminderChannelId: 'C777',
    });
    assert.strictEqual(fakeClient.views.publish.mock.callCount(), 1);
  });

  it('should fetch today events and DM user on ACTION_CHECK_TODAY', async () => {
    const app = createMockApp();
    const ackMock = mock.fn(async () => {});
    const getEventsMock = mock.fn(async () => [{ summary: '全体会議', start: { date: '2026-11-17' } }]);

    registerSetupUiListeners(
      app,
      { appName: 'calendar-reminder-bot', includeReminderOptions: true },
      { getUpcomingEvents: getEventsMock, targetDate: '2026-11-17T09:00:00+09:00' },
    );

    const handler = app.handlers.actions.get(ACTION_CHECK_TODAY);
    await handler({
      ack: ackMock,
      body: { user: { id: 'U9' }, team: { id: 'W9' } },
      context: { teamId: 'W9' },
      client: fakeClient,
      logger: fakeLogger,
    });

    assert.strictEqual(ackMock.mock.callCount(), 1);
    assert.strictEqual(fakeClient.chat.postMessage.mock.callCount(), 1);
    assert(fakeClient.chat.postMessage.mock.calls[0].arguments[0].text.includes('全体会議'));
  });

  it('should log error when action handler throws exception', async () => {
    const app = createMockApp();
    const testError = new Error('views.open failed');
    fakeClient.views.open = mock.fn(async () => {
      throw testError;
    });

    registerSetupUiListeners(
      app,
      { appName: 'message-calendar-bot', includeReminderOptions: false },
      { getWorkspaceCalendarConfig: mock.fn(async () => null) },
    );

    const handler = app.handlers.actions.get(ACTION_OPEN_SETTINGS);
    await handler({
      ack: mock.fn(async () => {}),
      body: { trigger_id: 'TRIG_ERR' },
      context: { teamId: 'W1' },
      client: fakeClient,
      logger: fakeLogger,
    });

    assert.strictEqual(fakeLogger.error.mock.callCount(), 1);
    assert.strictEqual(fakeLogger.error.mock.calls[0].arguments[0], testError);
  });

  it('should send welcome setup DM on OAuth install and isolate fetch failures', async () => {
    const fetchMock = mock.fn(async () => ({ ok: true }));
    await sendWelcomeSetupDm({
      installation: { bot: { token: 'xoxb-new' }, user: { id: 'U_INSTALLER' } },
      appName: 'message-calendar-bot',
      fetchFn: fetchMock,
    });

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
    assert.strictEqual(body.channel, 'U_INSTALLER');
    assert(JSON.stringify(body.blocks).includes(ACTION_OPEN_SETTINGS));

    // 例外が起きても外へ投げないことを確認
    const failingFetch = mock.fn(async () => {
      throw new Error('Network error');
    });
    await assert.doesNotReject(() =>
      sendWelcomeSetupDm({
        installation: { bot: { token: 'xoxb-new' }, user: { id: 'U_INSTALLER' } },
        appName: 'message-calendar-bot',
        fetchFn: failingFetch,
      }),
    );
  });
});
