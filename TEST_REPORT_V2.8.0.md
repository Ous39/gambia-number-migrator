# Test Report v2.8.0

Executed 31 July 2026 in the Codex Linux workspace with Node 24 and pnpm 9.12.3/lockfile dependencies.

| Check | Result | Evidence/notes |
|---|---|---|
| Clean frozen install | Passed | 864 packages installed from the unchanged lockfile. |
| Shared build | Passed | TypeScript build completed. |
| TypeScript all workspaces | Passed | Shared, API, Admin, and Mobile completed with no errors. |
| Unit/API tests | Passed | Shared rule engine: 9/9; API health: 1/1. Admin/Mobile contain no test files and passed only because `--passWithNoTests` is configured. |
| Admin production build | Passed | Vite production bundle generated. |
| API production build | Passed | TypeScript output generated. |
| Expo export | Passed | Web, Android, and iOS bundles exported successfully. This is not a signed native APK/IPA build. |
| Lint | Equivalent only | Workspace `lint` scripts are TypeScript checks; covered by successful typecheck. No ESLint rules exist. |
| Formatting | Not available | No formatter/check script is configured. Add Prettier or Biome before claiming this gate. |
| Dependency audit | Failed release gate | 17 advisories: 9 moderate, 7 high, 1 critical, including transitive Expo CLI/tar, Vite, and React Router paths. Test framework/platform upgrades before production. |
| Database migration | Static validation only | Migration 014 is transactional through the migration runner, but no PostgreSQL service/production clone was available. Run staging migration command below. |
| Database rollback | Not supported automatically | Migrations are forward-only. Restore the pre-migration database snapshot if rollback is required. |
| Android/iOS config | Passed static/export validation | Package/bundle IDs preserved; versionCode/buildNumber 28. Signing, permissions, contacts, notifications, and store builds need physical-device/EAS testing. |
| Screenshots | Blocked | No authenticated staging API/seeded database and no Android/iOS emulator or physical device were available. A capture script and directory manifest are included. |
| ZIP integrity | Run at packaging | See archive test output accompanying the delivered ZIP. |

Staging database validation:

```bash
pnpm db:migrate
psql "$DATABASE_URL" -c "select filename from schema_migrations order by filename;"
psql "$DATABASE_URL" -c "\d payments"
psql "$DATABASE_URL" -c "\d payment_webhook_events"
```

Success means migration 014 is recorded, both new payment structures exist, old data remains readable, and API payment tests against sandbox callbacks pass.
