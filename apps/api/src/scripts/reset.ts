import { pool } from '../db/pool';
async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.end();
  console.log('Database reset. Run pnpm --filter @gnm/api db:migrate && pnpm --filter @gnm/api db:seed');
}
main().catch((err) => { console.error(err); process.exit(1); });
