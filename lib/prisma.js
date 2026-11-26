import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

/**
 * データベース接続クライアント（PrismaClient）の共通モジュール
 */
const globalForPrisma = globalThis;

/**
 * PrismaClient を生成する初期化関数
 *
 * @param {object} [options={}] - テスト時の DI（依存性注入）用オプション
 * @param {NodeJS.ProcessEnv} [options.env=process.env] - 環境変数オブジェクト
 * @param {typeof PrismaMariaDb} [options.AdapterClass=PrismaMariaDb] - DB ドライバアダプタークラス
 * @param {typeof PrismaClient} [options.ClientClass=PrismaClient] - PrismaClient クラス
 * @returns {PrismaClient | null} 初期化された PrismaClient インスタンス、または DATABASE_URL 未設定時は null
 */
export function createPrismaClient(options = {}) {
  const env = options.env ?? process.env;
  const AdapterClass = options.AdapterClass ?? PrismaMariaDb;
  const ClientClass = options.ClientClass ?? PrismaClient;
  const connectionString = env.DATABASE_URL;

  // DATABASE_URLが未設定またはプレースホルダーの場合は null を返してスキップ
  if (!connectionString || connectionString.includes('YOUR_')) {
    return null;
  }

  // @prisma/adapter-mariadb は接続URL文字列を直接受け取る仕様（{ connectionString } 形式は未対応）
  const adapter = new AdapterClass(connectionString);
  return new ClientClass({ adapter });
}

/**
 * アプリケーション全体で共有される PrismaClient インスタンス
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// 本番環境以外（ローカル開発時）は、グローバル変数に退避させて重複生成を防止
if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma;
}
