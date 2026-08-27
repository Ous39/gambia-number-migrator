import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

// Exercises the migration runner against disposable scenario databases so a
// broken/non-idempotent migration (like the 020 foreign-key bug) is caught
// before it reaches a real environment. Connects with the same credentials as
// DATABASE_URL but talks to throwaway databases it creates and drops itself -
// it never touches the database DATABASE_URL points at.
//
// Usage: pnpm --filter @gnm/api db:verify-migrations
// Requires a reachable Postgres server with CREATEDB privilege (the default
// docker-compose Postgres service qualifies).

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../database/migrations');
const BASE_URL = process.env.DATABASE_URL || 'postgres://gnm_user:gnm_password@localhost:5434/gambia_number_migrator';
const adminUrl = new URL(BASE_URL);

function scenarioUrl(dbName: string) {
  const url = new URL(BASE_URL);
  url.pathname = `/${dbName}`;
  return url.toString();
}

// CREATE DATABASE / DROP DATABASE cannot run inside the database being
// created or dropped, so admin operations always connect to the maintenance
// "postgres" database that every Postgres server ships with.
async function adminQuery(sql: string) {
  const client = new Client({ connectionString: scenarioUrl('postgres') });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function createScenarioDb(name: string) {
  await adminQuery(`DROP DATABASE IF EXISTS ${name}`);
  await adminQuery(`CREATE DATABASE ${name}`);
}

async function dropScenarioDb(name: string) {
  await adminQuery(`DROP DATABASE IF EXISTS ${name}`);
}

function migrationFiles(upTo?: number) {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .filter((file) => (upTo === undefined ? true : Number(file.split('_')[0]) <= upTo))
    .sort();
}

async function runMigrations(dbName: string, upTo?: number) {
  const client = new Client({ connectionString: scenarioUrl(dbName) });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for (const file of migrationFiles(upTo)) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [file]);
      if (applied.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function assertConstraintExists(dbName: string, constraintName: string, table: string) {
  const client = new Client({ connectionString: scenarioUrl(dbName) });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = $2::regclass`,
      [constraintName, table]
    );
    if (!result.rowCount) throw new Error(`Expected constraint ${constraintName} on ${table} but it was not found.`);
  } finally {
    await client.end();
  }
}

async function appliedCount(dbName: string) {
  const client = new Client({ connectionString: scenarioUrl(dbName) });
  await client.connect();
  try {
    const result = await client.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
    return result.rows[0].count as number;
  } finally {
    await client.end();
  }
}

type Scenario = { name: string; run: () => Promise<void> };

const scenarios: Scenario[] = [
  {
    name: 'Clean database: full migration set applies without error',
    async run() {
      const db = 'gnm_verify_clean';
      await createScenarioDb(db);
      try {
        await runMigrations(db);
        await assertConstraintExists(db, 'fk_payments_device', 'payments');
        const count = await appliedCount(db);
        if (count !== migrationFiles().length) throw new Error(`Expected ${migrationFiles().length} recorded migrations, got ${count}`);
      } finally {
        await dropScenarioDb(db);
      }
    },
  },
  {
    name: 'Migration rerun: applying the same set twice is a no-op the second time',
    async run() {
      const db = 'gnm_verify_rerun';
      await createScenarioDb(db);
      try {
        await runMigrations(db);
        const firstCount = await appliedCount(db);
        await runMigrations(db); // rerun - everything should be skipped, not reapplied
        const secondCount = await appliedCount(db);
        if (firstCount !== secondCount) throw new Error(`Rerun changed applied migration count: ${firstCount} -> ${secondCount}`);
      } finally {
        await dropScenarioDb(db);
      }
    },
  },
  {
    name: 'Constraint present but migration not recorded: 020 does not fail (the reported bug)',
    async run() {
      const db = 'gnm_verify_unrecorded_fk';
      await createScenarioDb(db);
      try {
        await runMigrations(db, 19); // everything up to but not including 020
        // Simulate the FK having been added out-of-band (manual hotfix, or a
        // previous partial run) without schema_migrations recording 020.
        const client = new Client({ connectionString: scenarioUrl(db) });
        await client.connect();
        await client.query(`ALTER TABLE payments ADD CONSTRAINT fk_payments_device FOREIGN KEY (device_id) REFERENCES devices(id)`);
        await client.end();
        // Now run the full set including 020 - it must detect the existing
        // constraint and skip re-adding it instead of throwing "already exists".
        await runMigrations(db);
        await assertConstraintExists(db, 'fk_payments_device', 'payments');
      } finally {
        await dropScenarioDb(db);
      }
    },
  },
  {
    name: 'Upgrade from a pre-020 database with existing orphaned payment rows',
    async run() {
      const db = 'gnm_verify_upgrade';
      await createScenarioDb(db);
      try {
        await runMigrations(db, 19); // state equivalent to a v2.8.x install before the FK migration existed
        const client = new Client({ connectionString: scenarioUrl(db) });
        await client.connect();
        // A payment referencing a device_id that was never registered - this is
        // exactly the data shape 020's backfill INSERT exists to repair.
        await client.query(
          `INSERT INTO payments (provider, reference, device_id, feature_key, amount, status)
           VALUES ('wave', 'REF-UPGRADE-TEST', 'orphan-device-1', 'bulk_unlock', 25, 'completed')`
        );
        await client.end();
        await runMigrations(db);
        await assertConstraintExists(db, 'fk_payments_device', 'payments');
        const check = new Client({ connectionString: scenarioUrl(db) });
        await check.connect();
        const orphanDevice = await check.query(`SELECT 1 FROM devices WHERE id = 'orphan-device-1'`);
        await check.end();
        if (!orphanDevice.rowCount) throw new Error('020 should have backfilled a devices row for the orphaned payment before adding the FK.');
      } finally {
        await dropScenarioDb(db);
      }
    },
  },
];

async function main() {
  console.log(`Verifying migrations in ${MIGRATIONS_DIR} against ${adminUrl.host}...`);
  let failures = 0;
  for (const scenario of scenarios) {
    process.stdout.write(`- ${scenario.name} ... `);
    try {
      await scenario.run();
      console.log('OK');
    } catch (error) {
      failures++;
      console.log('FAILED');
      console.error(`  ${(error as Error).message}`);
    }
  }
  if (failures) {
    console.error(`\n${failures} of ${scenarios.length} migration scenarios failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${scenarios.length} migration scenarios passed.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
