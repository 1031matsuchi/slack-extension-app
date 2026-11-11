import { pallotCommandCallback } from './pallot-command.js';
import { sampleCommandCallback } from './sample-command.js';

export const register = (app) => {
  app.command('/sample-command', sampleCommandCallback);
  app.command('/palloting', pallotCommandCallback);
};
