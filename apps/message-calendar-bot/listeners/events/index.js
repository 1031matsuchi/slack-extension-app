import { reactionAddedCallback } from './reaction-added.js';

export const register = (app) => {
  app.event('reaction_added', (args) => reactionAddedCallback(args));
};
