import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';

async function main() {
  const dir = path.resolve(__dirname, '../../../../database/migrations');
  const files = fs.readdirSync(dir).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [file]);
    if (applied.rowCount) {
      console.log(`Skipping migration ${file} (already applied)`);
      continue;
    }
    const client = await pool.connect();
    try {
      console.log(`Running migration ${file}`);
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((error) => { console.error(error); process.exit(1); });
