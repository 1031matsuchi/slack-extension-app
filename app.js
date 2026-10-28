import http from 'node:http';
import { config } from 'dotenv';
import { loadAllApps } from './apps/index.js';

config();

const port = process.env.PORT || 3000;

export const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});

export const startApps = async (env = process.env) => {
  const apps = await loadAllApps(env);
  if (apps.length === 0) {
    console.log('No Slack apps were loaded.');
  }

  await Promise.all(
    apps.map(async (app) => {
      try {
        await app.start();
        console.log(`⚡️ Bolt app (${app.name}) is running!`);
      } catch (error) {
        console.error(`Failed to start app (${app.name}):`, error);
      }
    }),
  );

  return apps;
};

server.listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});

startApps();
