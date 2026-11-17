import * as commands from './commands/index.js';
import * as events from './events/index.js';
import * as messages from './messages/index.js';

export const registerListeners = (app) => {
  commands.register(app);
  events.register(app);
  messages.register(app);
};
