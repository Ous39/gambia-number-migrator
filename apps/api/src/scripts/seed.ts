import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { buildRulesPayload } from '../services/rulePayload';

async function main() {
  const dir = path.resolve(__dirname, '../../../../database/seeds');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log(`Running seed ${file}`);
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || '';
  if (initialPassword.length < 12 || initialPassword === 'replace-with-a-strong-password') throw new Error('ADMIN_INITIAL_PASSWORD must be configured with a unique password of at least 12 characters');
  const hash = await bcrypt.hash(initialPassword, 12);
  const admin = await pool.query(`INSERT INTO admins (username, password_hash, full_name, role, status)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (username) DO UPDATE SET full_name=EXCLUDED.full_name, role=CASE WHEN admins.role='admin' THEN 'owner' ELSE admins.role END, updated_at=NOW()
    RETURNING id`, ['admin', hash, 'System Owner', 'owner', 'active']);
  const existing = await pool.query('SELECT COUNT(*)::int count FROM rules_versions');
  if (existing.rows[0].count === 0) {
    const payload = await buildRulesPayload();
    if (payload.rules.length) {
      payload.versionNumber = 1;
      await pool.query('INSERT INTO rules_versions (version_number, rules_json, published_by, status) VALUES ($1,$2,$3,$4)', [1, JSON.stringify(payload), admin.rows[0].id, 'published']);
      console.log('Published active migration rules version 1');
    } else console.log('No official active rules found. Publish verified rules from the admin portal before scanning.');
  }
  await pool.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
