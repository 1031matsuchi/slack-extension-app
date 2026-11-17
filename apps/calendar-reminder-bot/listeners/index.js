import { registerSetupUiListeners } from '../../../lib/slack-setup-ui.js';
import * as messages from './messages/index.js';

export const registerListeners = (app) => {
  registerSetupUiListeners(app, { appName: 'calendar-reminder-bot', includeReminderOptions: true });
  messages.register(app);
};
