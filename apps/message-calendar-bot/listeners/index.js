import { registerSetupUiListeners } from '../../../lib/slack-setup-ui.js';
import * as events from './events/index.js';
import * as messages from './messages/index.js';

export const registerListeners = (app) => {
  registerSetupUiListeners(app, { appName: 'message-calendar-bot', includeReminderOptions: false });
  events.register(app);
  messages.register(app);
};
