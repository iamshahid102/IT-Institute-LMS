/**
 * Development-only PostgreSQL launcher.
 * Uses PostgreSQL binaries bundled by `embedded-postgres` so a contributor can run
 * the API and its integration tests without Docker or a system Postgres install.
 * Production deployments must use a managed PostgreSQL service.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = path.resolve(process.cwd(), '.pgdata');
const port = Number(process.env.LOCAL_DB_PORT ?? 55432);
const user = 'lms';
const password = 'lmsdev';
const databases = ['lms_dev', 'lms_test'];

const freshlyInitialised = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (freshlyInitialised) {
  await pg.initialise();
}

await pg.start();

for (const database of databases) {
  try {
    await pg.createDatabase(database);
    console.log(`Created database ${database}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      console.error(`Could not create ${database}: ${message}`);
    }
  }
}

console.log(`PostgreSQL listening on 127.0.0.1:${port} (user ${user}). Press Ctrl+C to stop.`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

// Keep the launcher alive for the lifetime of the development session.
setInterval(() => undefined, 60_000);
