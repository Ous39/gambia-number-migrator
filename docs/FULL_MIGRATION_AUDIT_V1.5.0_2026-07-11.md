# Full Migration Audit — v1.5.0 — 11 July 2026

## Critical migration fixes

- Saved Preview data is no longer trusted as authority. Every selected old/new pair is regenerated and matched against the current published rule and rule ID immediately before modification.
- Add, Replace, and Cleanup stop before changing anything if any selected contact cannot be read and captured in the verified backup.
- Every device write is re-read and verified. Unverified writes are counted as failures and remain recoverable through the backup.
- Replace mode is enforced in both the UI and contact service using the administrator transition setting.
- Cleanup revalidates every pair with approved current rules before backup and again against the live contact.
- Scan state is cleared after any add, replace, cleanup, or restore so old results cannot be reused.

## Number and rule engine fixes

- Added support for local numbers and `+220`, `220`, and `00220` international styles.
- Replacements preserve the original international/local style.
- Invalid values no longer compare as equal phone numbers.
- Migration prefixes must contain exactly two digits and must generate a nine-digit number.
- A rule prefix must match its operator's configured migration prefix.
- Empty exception rules and invalid transition date/mode combinations are rejected.
- Equal-priority, equal-specificity overlapping rules for different operators are blocked at publish and return Manual Review at runtime.
- Approved payload validation confirms active operators, matching prefixes, no demo markers, and no ambiguous conflicts.

## Database migration fixes

- Added `schema_migrations` tracking.
- Each SQL migration runs once inside its own transaction.
- Failed migrations roll back instead of leaving a partially changed schema.
- Seed configuration uses `ON CONFLICT DO NOTHING`, preserving administrator edits.
- Migration `009_migration_integrity_constraints.sql` disables invalid legacy prefixes and adds database constraints.
- PostgreSQL unique, foreign-key, check, and invalid-value errors now return useful 4xx responses.

## Connected fixes

- Cleanup no longer preselects all duplicates.
- Cleanup now requires payment, uses the selected count, includes its backup ID, and removes obsolete test-mode wording.
- Payment amount/currency are validated against server configuration.
- OTP success uses a conditional atomic update with attempt and expiry checks.
- A successful payment cannot later be downgraded by an out-of-order callback.
- Missing migration rules/operators return 404 responses; missing transition settings can be created safely.

## Validation

- Added tests for `00220`, invalid-number comparison, international formatting, unrelated same-operator numbers, safe pair verification, and ambiguous rules.
- All JSON files and final ZIP structure were validated.
- Dependency installation was attempted again, but the npm registry returned HTTP 502 for transitive packages. This prevented complete TypeScript, Vitest, Expo export, and admin/API build execution in this environment.

## Required local verification

1. Copy `.env.example` to `.env` and configure secrets.
2. Run `pnpm install`.
3. Run migrations `001` through `009` with `pnpm db:migrate`.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
5. Publish verified official operator ranges from Admin.
6. Test Add, Replace, Cleanup, and Restore on disposable contacts before production rollout.
