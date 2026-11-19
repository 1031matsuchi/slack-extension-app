import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createPrismaInstallationStore } from '../../lib/slack-installation-store.js';

describe('slack-installation-store', () => {
  it('should throw error when appName is empty', () => {
    assert.throws(() => createPrismaInstallationStore(''), /appName/);
  });

  it('should store installation via prisma upsert', async () => {
    const upsertMock = mock.fn(async () => ({}));
    const fakePrisma = { slackInstallation: { upsert: upsertMock } };
    const store = createPrismaInstallationStore('message-calendar-bot', fakePrisma);

    await store.storeInstallation({
      team: { id: 'T123', name: 'Test Workspace' },
      bot: {
        token: 'xoxb-test-token',
        id: 'B123',
        userId: 'U_BOT',
        scopes: ['chat:write', 'reactions:read'],
      },
      user: { id: 'U_INSTALLER' },
    });

    assert.strictEqual(upsertMock.mock.callCount(), 1);
    const args = upsertMock.mock.calls[0].arguments[0];
    assert.deepEqual(args.where, {
      appName_workspaceId: { appName: 'message-calendar-bot', workspaceId: 'T123' },
    });
    assert.strictEqual(args.create.workspaceId, 'T123');
    assert.strictEqual(args.create.workspaceName, 'Test Workspace');
    assert.strictEqual(args.create.botToken, 'xoxb-test-token');
    assert.strictEqual(args.create.botScopes, 'chat:write,reactions:read');
    assert.strictEqual(args.create.installedUserId, 'U_INSTALLER');
  });

  it('should throw error on storeInstallation when prisma is null', async () => {
    const store = createPrismaInstallationStore('message-calendar-bot', null);
    await assert.rejects(
      () =>
        store.storeInstallation({
          team: { id: 'T123' },
          bot: { token: 'xoxb-test' },
        }),
      /DATABASE_URL/,
    );
  });

  it('should fetch installation and format Bolt Installation object', async () => {
    const findUniqueMock = mock.fn(async () => ({
      appName: 'message-calendar-bot',
      workspaceId: 'T456',
      workspaceName: 'Acme Corp',
      enterpriseId: null,
      botToken: 'xoxb-acme',
      botId: 'B456',
      botUserId: 'U_BOT_456',
      botScopes: 'files:read,chat:write',
      installedUserId: 'U_USER_1',
    }));
    const fakePrisma = { slackInstallation: { findUnique: findUniqueMock } };
    const store = createPrismaInstallationStore('message-calendar-bot', fakePrisma);

    const result = await store.fetchInstallation({ teamId: 'T456' });

    assert.strictEqual(findUniqueMock.mock.callCount(), 1);
    assert.strictEqual(result.team.id, 'T456');
    assert.strictEqual(result.team.name, 'Acme Corp');
    assert.strictEqual(result.bot.token, 'xoxb-acme');
    assert.deepEqual(result.bot.scopes, ['files:read', 'chat:write']);
  });

  it('should throw error on fetchInstallation when record is not found', async () => {
    const fakePrisma = { slackInstallation: { findUnique: mock.fn(async () => null) } };
    const store = createPrismaInstallationStore('calendar-reminder-bot', fakePrisma);

    await assert.rejects(() => store.fetchInstallation({ teamId: 'T999' }), /インストール情報が見つかりません/);
  });

  it('should delete installation via prisma deleteMany', async () => {
    const deleteManyMock = mock.fn(async () => ({ count: 1 }));
    const fakePrisma = { slackInstallation: { deleteMany: deleteManyMock } };
    const store = createPrismaInstallationStore('calendar-reminder-bot', fakePrisma);

    await store.deleteInstallation({ teamId: 'T789' });

    assert.strictEqual(deleteManyMock.mock.callCount(), 1);
    assert.deepEqual(deleteManyMock.mock.calls[0].arguments[0], {
      where: { appName: 'calendar-reminder-bot', workspaceId: 'T789' },
    });
  });
});
