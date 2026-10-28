import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const loadAllApps = async (env = process.env, options = {}, baseDir = currentDir) => {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const appDirs = entries.filter((entry) => entry.isDirectory());
  const apps = [];

  for (const dir of appDirs) {
    const appDirName = dir.name;
    const indexPath = path.join(baseDir, appDirName, 'index.js');

    if (!existsSync(indexPath)) {
      continue;
    }

    try {
      const moduleUrl = pathToFileURL(indexPath).href;
      const appModule = await import(moduleUrl);

      if (typeof appModule.initApp !== 'function') {
        console.warn(`Skipping app "${appDirName}": initApp function not found.`);
        continue;
      }

      const app = await appModule.initApp(env, options);
      if (!app) {
        console.log(`Skipping app "${appDirName}": tokens are not configured.`);
        continue;
      }

      app.name = app.name || appDirName;
      apps.push(app);
    } catch (error) {
      console.error(`Failed to load app "${appDirName}":`, error);
    }
  }

  return apps;
};
