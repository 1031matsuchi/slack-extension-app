import { fileSharedCallback } from './file-shared.js';

export const register = (app) => {
  app.event('file_shared', (args) => fileSharedCallback(args));
};
