import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createApp } from '../../scripts/create-app.js';

describe('createApp script', () => {
  it('should scaffold a new app and update env files', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'create-app-test-'));

    try {
      await createApp('custom-bot', { rootDir: tempDir });

      const appDir = path.join(tempDir, 'apps', 'custom-bot');
      assert.ok(existsSync(path.join(appDir, 'index.js')));
      assert.ok(existsSync(path.join(appDir, 'manifest.json')));
      assert.ok(existsSync(path.join(appDir, 'listeners', 'index.js')));
      assert.ok(existsSync(path.join(appDir, 'listeners', 'events', 'app-home-opened.js')));
      assert.ok(existsSync(path.join(appDir, 'listeners', 'messages', 'sample-message.js')));

      const envSampleContent = await readFile(path.join(tempDir, '.env.sample'), 'utf8');
      assert.ok(envSampleContent.includes('CUSTOM_BOT_BOT_TOKEN'));
      assert.ok(envSampleContent.includes('CUSTOM_BOT_APP_TOKEN'));

      const manifestContent = JSON.parse(await readFile(path.join(appDir, 'manifest.json'), 'utf8'));
      assert.strictEqual(manifestContent.display_information.name, 'custom-bot');
      assert.strictEqual(manifestContent.features.bot_user.display_name, 'custom-bot');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw an error when app already exists', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'create-app-test-'));

    try {
      await createApp('duplicate-bot', { rootDir: tempDir });
      await assert.rejects(() => createApp('duplicate-bot', { rootDir: tempDir }), /already exists/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
