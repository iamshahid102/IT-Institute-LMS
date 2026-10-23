import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import dotenv from 'dotenv';

const apiRoot = process.cwd();

/**
 * Applies the committed Prisma migrations to the test database before the suite runs, so the
 * tests always exercise the schema a clean deployment would get. Refuses to touch any database
 * whose name does not end in `_test`.
 */
export default function globalSetup(): void {
  if (!existsSync(path.join(apiRoot, 'prisma', 'schema.prisma'))) {
    throw new Error(
      `Run the test suite from apps/api (current working directory: ${apiRoot}).`,
    );
  }

  dotenv.config({ path: path.join(apiRoot, '.env.test') });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured for the test environment (apps/api/.env.test).');
  }

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!/_test$/.test(databaseName)) {
    throw new Error(
      `Refusing to run the test suite against "${databaseName}": the test database name must end with "_test".`,
    );
  }

  // Run Prisma's CLI with the current Node binary: spawning `npx.cmd` directly is blocked on
  // Windows for security reasons, so resolving the CLI entry point keeps this portable.
  const require = createRequire(path.join(apiRoot, 'package.json'));
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
