import { checkTodayCallback } from './check-today.js';
import { setCalendarCallback } from './set-calendar.js';
import { setReminderChannelCallback } from './set-reminder-channel.js';

export const register = (app) => {
  app.command('/set-calendar', (args) => setCalendarCallback(args));
  app.command('/set-reminder-channel', (args) => setReminderChannelCallback(args));
  app.command('/check-today', (args) => checkTodayCallback(args));
};
