import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

declare global {
  var __lmsPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__lmsPrisma ??
  new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (!env.isProduction) {
  globalThis.__lmsPrisma = prisma;
}
