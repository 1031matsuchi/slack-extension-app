import * as events from './events/index.js';
import * as messages from './messages/index.js';

export const registerListeners = (app) => {
  events.register(app);
  messages.register(app);
};
