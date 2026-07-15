import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';

const server = createApp().listen(env.port, () => {
  console.log(`Gambia Number Migrator API running on http://localhost:${env.port}/api`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; closing server`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
