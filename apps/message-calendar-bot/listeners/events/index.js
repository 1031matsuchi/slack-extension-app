import { appHomeOpenedCallback } from './app-home-opened.js';
import { reactionAddedCallback } from './reaction-added.js';

export const register = (app) => {
  app.event('app_home_opened', appHomeOpenedCallback);
  app.event('reaction_added', (args) => reactionAddedCallback(args));
};
