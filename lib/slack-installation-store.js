import { prisma } from './prisma.js';

/**
 * ワークスペースIDを Installation / InstallQuery オブジェクトから安全に取り出す
 * Slack Bolt 内部の仕様上プロパティ名が team / teamId になっているため、ここで workspaceId として吸収する
 *
 * @param {object} payload - Slack Bolt の installation または installQuery
 * @returns {string | undefined} 抽出された workspaceId（Enterprise Grid の場合は enterpriseId）
 */
const extractWorkspaceId = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  if (payload.isEnterpriseInstall) {
    return payload.enterprise?.id ?? payload.enterpriseId;
  }
  return payload.team?.id ?? payload.teamId ?? payload.workspaceId;
};

/**
 * Prisma クライアントが利用可能か検証する
 *
 * @param {import('@prisma/client').PrismaClient | null} prismaClient - PrismaClient インスタンス
 * @returns {import('@prisma/client').PrismaClient} 有効な PrismaClient インスタンス
 */
const requirePrisma = (prismaClient) => {
  if (!prismaClient) {
    throw new Error('DATABASE_URL が未設定のため、OAuth インストールストアを利用できません。');
  }
  return prismaClient;
};

/**
 * Slack Bolt 用の Prisma ベース InstallationStore を生成する
 * 3つのアプリ（appName）で1つのテーブルを共有し、appName + workspaceId の複合ユニークキーで分離保存する
 *
 * @param {string} appName - アプリ識別名（例: 'message-calendar-bot'）
 * @param {import('@prisma/client').PrismaClient | null} [prismaClient=prisma] - DI用の PrismaClient
 * @returns {object} Slack Bolt の installationStore 互換オブジェクト
 */
export function createPrismaInstallationStore(appName, prismaClient = prisma) {
  if (!appName || typeof appName !== 'string' || !appName.trim()) {
    throw new Error('createPrismaInstallationStore には有効な appName の指定が必要です。');
  }

  const normalizedAppName = appName.trim();

  return {
    /**
     * OAuth インストール成功時にトークン情報を DB へ保存（または更新）する
     *
     * @param {object} installation - Slack Bolt から渡されるインストール情報
     */
    async storeInstallation(installation) {
      const db = requirePrisma(prismaClient);
      const workspaceId = extractWorkspaceId(installation);

      if (!workspaceId) {
        throw new Error('インストール情報から workspaceId を取得できませんでした。');
      }

      const botToken = installation.bot?.token;
      if (!botToken) {
        throw new Error('Bot トークンが含まれていないため保存できません。');
      }

      const botScopes = Array.isArray(installation.bot?.scopes)
        ? installation.bot.scopes.join(',')
        : (installation.bot?.scopes ?? '');

      const data = {
        appName: normalizedAppName,
        workspaceId,
        workspaceName: installation.team?.name ?? null,
        enterpriseId: installation.enterprise?.id ?? null,
        botToken,
        botId: installation.bot?.id ?? null,
        botUserId: installation.bot?.userId ?? null,
        botScopes,
        installedUserId: installation.user?.id ?? null,
      };

      // すでに同一アプリ・同一ワークスペースのレコードがあれば更新、なければ新規作成する
      await db.slackInstallation.upsert({
        where: {
          appName_workspaceId: {
            appName: normalizedAppName,
            workspaceId,
          },
        },
        create: data,
        update: {
          workspaceName: data.workspaceName,
          enterpriseId: data.enterpriseId,
          botToken: data.botToken,
          botId: data.botId,
          botUserId: data.botUserId,
          botScopes: data.botScopes,
          installedUserId: data.installedUserId,
        },
      });
    },

    /**
     * イベント受信時などに DB からワークスペースのトークン情報を復元する
     *
     * @param {object} installQuery - Slack Bolt から渡される検索クエリ
     * @returns {Promise<object>} Slack Bolt が要求する Installation 形式のオブジェクト
     */
    async fetchInstallation(installQuery) {
      const db = requirePrisma(prismaClient);
      const workspaceId = extractWorkspaceId(installQuery);

      if (!workspaceId) {
        throw new Error('検索クエリから workspaceId を取得できませんでした。');
      }

      const record = await db.slackInstallation.findUnique({
        where: {
          appName_workspaceId: {
            appName: normalizedAppName,
            workspaceId,
          },
        },
      });

      if (!record) {
        throw new Error(`インストール情報が見つかりません (appName=${normalizedAppName}, workspaceId=${workspaceId})`);
      }

      // Slack Bolt の仕様上、返却オブジェクトのキー名は "team" である必要があるためここでマッピングする
      return {
        team: {
          id: record.workspaceId,
          name: record.workspaceName ?? undefined,
        },
        enterprise: record.enterpriseId ? { id: record.enterpriseId } : undefined,
        bot: {
          token: record.botToken,
          id: record.botId ?? undefined,
          userId: record.botUserId ?? undefined,
          scopes: record.botScopes ? record.botScopes.split(',').filter(Boolean) : [],
        },
        user: {
          id: record.installedUserId ?? undefined,
          token: undefined,
          scopes: undefined,
        },
      };
    },

    /**
     * アプリのアンインストール時に DB からトークン情報を削除する
     *
     * @param {object} installQuery - Slack Bolt から渡される削除対象クエリ
     */
    async deleteInstallation(installQuery) {
      const db = requirePrisma(prismaClient);
      const workspaceId = extractWorkspaceId(installQuery);

      if (!workspaceId) {
        throw new Error('削除クエリから workspaceId を取得できませんでした。');
      }

      // レコードが既に存在しない場合でも例外にならないよう deleteMany を使用する
      await db.slackInstallation.deleteMany({
        where: {
          appName: normalizedAppName,
          workspaceId,
        },
      });
    },
  };
}
