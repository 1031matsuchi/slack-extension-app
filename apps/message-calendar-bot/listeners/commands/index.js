import { setCalendarCallback } from './set-calendar.js';

export const register = (app) => {
  app.command('/set-calendar', (args) => setCalendarCallback(args));
};
