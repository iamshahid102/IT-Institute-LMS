import { prisma } from '../../src/lib/prisma';

/**
 * Empties every application table between tests. Only used by the automated suite, which the
 * global setup points at a dedicated `*_test` database, so no development data is affected.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables
    .map((table) => `"public"."${table.tablename.replace(/"/g, '""')}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
