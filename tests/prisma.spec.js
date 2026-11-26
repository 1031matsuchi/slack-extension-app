import assert from 'node:assert';
import { describe, it } from 'node:test';
import { createPrismaClient, prisma } from '../lib/prisma.js';

describe('prisma client module', () => {
  it('should return null from createPrismaClient when DATABASE_URL is missing', () => {
    // DATABASE_URL が未設定の環境をシミュレート
    const originalUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      const client = createPrismaClient();
      assert.strictEqual(client, null);
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('should return null from createPrismaClient when DATABASE_URL is a placeholder', () => {
    // プレースホルダー値の場合に安全にスキップされることを確認
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'mysql://YOUR_USER:YOUR_PASSWORD@localhost:3306/mydb';
      const client = createPrismaClient();
      assert.strictEqual(client, null);
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('should instantiate PrismaClient with valid DATABASE_URL', () => {
    // 有効な接続文字列が与えられた場合にインスタンスが生成されることを確認
    const client = createPrismaClient();
    assert.ok(client);
    // SlackInstallation および WorkspaceCalendarConfig モデルへのアクセサーが存在することを確認
    assert.ok(client.slackInstallation);
    assert.strictEqual(typeof client.slackInstallation.findMany, 'function');
    assert.ok(client.workspaceCalendarConfig);
    assert.strictEqual(typeof client.workspaceCalendarConfig.findMany, 'function');
  });

  it('should pass DATABASE_URL directly as a string to PrismaMariaDb adapter', () => {
    // @prisma/adapter-mariadb へオブジェクト形式ではなく URL 文字列を直接渡していることを検証する（回帰防止）
    const testUrl = 'mysql://root:@localhost:3306/test_db';
    let receivedAdapterArg;
    let receivedClientOptions;

    class MockAdapter {
      constructor(arg) {
        receivedAdapterArg = arg;
      }
    }

    class MockPrismaClient {
      constructor(opts) {
        receivedClientOptions = opts;
      }
    }

    const client = createPrismaClient({
      env: { DATABASE_URL: testUrl },
      AdapterClass: MockAdapter,
      ClientClass: MockPrismaClient,
    });

    assert.ok(client instanceof MockPrismaClient);
    assert.strictEqual(typeof receivedAdapterArg, 'string');
    assert.strictEqual(receivedAdapterArg, testUrl);
    assert.ok(receivedClientOptions?.adapter instanceof MockAdapter);
  });

  it('should export singleton prisma instance', () => {
    // モジュールから直接エクスポートされた prisma インスタンスを確認
    assert.ok(prisma);
    assert.strictEqual(typeof prisma.slackInstallation.findMany, 'function');
    assert.strictEqual(typeof prisma.workspaceCalendarConfig.findMany, 'function');
  });
});
