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
 * @returns {PrismaClient | null} 初期化された PrismaClient インスタンス、またはDETABASE_URL未設定時は null
 */
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  // DATABASE_URLが未設定またはプレースホルダーの場合は null を返してスキップ
  if (!connectionString || connectionString.includes('YOUR_')) {
    return null;
  }

  const adapter = new PrismaMariaDb({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * アプリケーション全体で共有される PrismaClient インスタンス
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// 本番環境以外（ローカル開発時）は、グローバル変数に退避させて重複生成を防止
if (process.env.NODE_ENV !== 'production' && prisma) {
  globalForPrisma.prisma = prisma;
}
