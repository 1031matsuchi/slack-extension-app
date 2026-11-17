import { appHomeOpenedCallback } from './app-home-opened.js';
import { fileSharedCallback } from './file-shared.js';

export const register = (app) => {
  app.event('app_home_opened', appHomeOpenedCallback);
  app.event('file_shared', (args) => fileSharedCallback(args));
};
