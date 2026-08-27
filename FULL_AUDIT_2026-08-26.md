# GNM Full Audit — 2026-08-26

> **Superseded.** This audit is preserved as a historical record of the project's state on 2026-08-26 and is accurate for that date, including its references to the Android package/iOS bundle identifier that was correct at the time (`com.oceanbrown.gambianumbermigrator`). That identifier was **replaced** with `gm.oceanbrown.gnm` on 2026-08-27 — see `GNM-v1.0.0-FINAL-AUDIT.md` and `CHANGELOG.md` for the current, authoritative release identity. Do not use the identifier below for a real build.

Source version bumped 2.10.0 → **2.11.0** (internal). Public store version stays `1.0.0` per release policy.

This audit worked from the project already present at
`GNM-v2.8.16-MOBILE-UI-SCAN-FIXED-FULL-SOURCE/` (source version 2.10.0, migrations through `024`,
includes `apps/web`), **not** from the supplied `gambia-number-migrator.rar`. The archive was extracted
and diffed and turned out to be an *older* snapshot (source version 2.8.17, migrations only through
`022`, no `apps/web`). Per the "do not combine files from previous versions" instruction, the older
archive was used only as a diff reference, never merged in. Note: the extracted archive contained a
live `.env` file with what appear to be real secrets — it was not opened, read, or copied anywhere.

## 1. Scope actually completed in this pass

Given the size of the original request (a from-scratch full-stack + mobile + release audit), this pass
prioritized the explicitly flagged **priority item (backup/restore)** first, then worked through the
other concretely-described, verifiable issues. It did **not** attempt a line-by-line audit of every
screen, every admin page, or every API route — see §7 for what remains.

### 1.1 Backup & restore (priority)

Investigated the full lifecycle: [contactsService.ts](apps/mobile/src/services/contactsService.ts),
[storage.ts](apps/mobile/src/services/storage.ts), [backup.tsx](apps/mobile/app/backup.tsx),
[operationService.ts](apps/mobile/src/services/operationService.ts).

Confirmed bugs and fixes:

| # | Bug | Fix |
|---|-----|-----|
| 1 | Backup integrity check only compared chunk **item counts**; a corrupted chunk with the right length passed silently. | Added a real content checksum (`backupChecksum`, cyrb53 non-cryptographic hash) computed at write time, verified again at write time and on every `loadBackupItems` read. |
| 2 | `restoreBackup` blind-overwrote a contact's **entire** phone array with the saved snapshot for every migration/cleanup backup (the `beforePhoneNumbers` path ran before the operation-aware reversal path ever could). Any number the user added to that contact *after* the backup was silently dropped. | Added `targetedRestorePhones()`: for `old_migration`-scope backups, restore now reverses only the specific old/new number pair recorded on the backup item, leaving every other number on the contact untouched. Full-snapshot overwrite is now used only for genuine full-contact backups (`manual_full_backup`/`full_contacts` scope), which is what a full-backup restore is supposed to do. |
| 3 | Restore swallowed the actual error per failed contact (`catch { failed++ }`), so failures were unexplained. | `failureDetails: {contactName, reason}[]` is now captured and returned/stored in history, matching the pattern already used by migration. |
| 4 | No lock between migration / cleanup / backup / restore. A restore could run concurrently with an in-flight migration (e.g. after leaving and reopening the app), both writing to contacts at once. | Added `assertNoConflictingOperation()`, checked at the top of `restoreBackup`, `createFullContactsBackup`, `applyDuplicateAdd`, `applyReplace`, `removeOldDuplicates`. |
| 5 | Restore did not check contacts permission before writing (only scan/backup did). | Added the same `ensureContactPermission()` guard used elsewhere. |
| 6 | Restore had no progress UI, no resumable job tracking, and no completion screen — only a spinner and an inline dialog. | Restore now emits progress via the same `MigrationProgress` shape as migration, is tracked through `operationService` (visible if you leave and return to the Backups screen), shows a live progress bar, and routes to a new `/restore-complete` summary screen (restored / skipped / failed / backup ID) mirroring the existing `backup-complete` screen. |
| 7 | Dead code: `latest.items?.length \|\| latest.itemCount \|\| 0` — `items` is always `undefined` on storage-v2 index entries, so this always fell through to `itemCount` anyway, but read as if it might not. | Simplified to `latest.itemCount \|\| 0` in both places on the Backups screen. |
| 8 | The 30-backup rolling cap evicts old backups silently; a history entry could point at a backup that no longer exists with no warning until restore was attempted. | The Backups screen now states the 30-backup limit up front in the privacy notice card. |

New files: [`app/restore-complete.tsx`](apps/mobile/app/restore-complete.tsx).

**Tests added** (19 new, all passing): [`storage.test.ts`](apps/mobile/src/services/storage.test.ts) (9 —
chunking across boundaries, index persistence across app-restart-equivalent reads, corrupted-chunk
detection, truncated-chunk detection, empty-backup rejection, delete, no orphaned chunk keys) and
[`contactsService.test.ts`](apps/mobile/src/services/contactsService.test.ts) (10 — duplicate_add /
replace_update reversal, idempotent repeat restore, non-destructive restore against a number added
after the backup, missing-contact partial failure with a captured reason, missing backup id, empty
backup, permission-denied, and both directions of the conflicting-operation lock).

### 1.2 Database migrations

- **Fixed `020_payments_device_fk.sql`** — `ALTER TABLE ... ADD CONSTRAINT` has no `IF NOT EXISTS` form
  in PostgreSQL, so a rerun (or a case where the FK was added out-of-band before `schema_migrations`
  recorded `020`) failed with "constraint already exists". Now wrapped in `DO $$ ... IF NOT EXISTS
  (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_device' ...) THEN ALTER TABLE ... END IF;
  END $$;`.
- Audited `021` and `022` — both already idempotent (`ON CONFLICT`). No changes needed.
- Checked all 24 migration files for BOM (none found) and duplicate numbering (none found).
- **Added `apps/api/src/scripts/verify-migrations.ts`** (`pnpm --filter @gnm/api db:verify-migrations`),
  covering exactly the scenarios requested: clean database, rerun/no-op, "constraint present but
  migration not recorded" (the reported 020 bug, reproduced directly), and an upgrade path from a
  pre-020 schema state with a pre-existing orphaned `payments` row (verifies the backfill `INSERT`
  in 020 still repairs it before the FK is added).
  **This script could not be executed in this environment** — see §7.

### 1.3 Cleanup screen wording and logic

- [`app/cleanup.tsx`](apps/mobile/app/cleanup.tsx): removed "Cleanup controlled by Admin" → replaced
  with "Availability schedule" (unavailable) / "Verified pairs only" (available), plus a second,
  always-visible notice card stating verbatim: *"Cleanup availability may be scheduled by the service,
  but contact scanning and cleanup happen entirely on this device. Administrators cannot view, access
  or delete your contacts."*
- **Found live via the dev server's own logs mid-session, not by static review**: `findCleanupCandidates`
  ([`packages/shared/src/migration.ts`](packages/shared/src/migration.ts)) generated one candidate per
  old-number phone row with no way to tell two rows apart. A contact with the exact same 7-digit number
  saved twice (duplicate/synced contact entries — a real, reachable case, and one of the explicitly
  requested test scenarios: "Identical duplicate numbers") produced two candidates sharing an identical
  `contactId:oldNumber:newNumber` key, which `FlatList` flagged as a live duplicate-key warning on the
  Cleanup screen (children can be duplicated or silently dropped from the list). Fixed by adding
  `phoneIndex` to `CleanupCandidate` (mirroring the field migration candidates already carry) and using
  it in the Cleanup screen's list key. New regression test reproduces the exact scenario.
- Verified the underlying cleanup logic already satisfies the 5 required conditions before removing a
  number: rule-match verification (`verifyMigratedPair` against currently published rules, not the
  scan-time rules), explicit per-item user selection, a verified local backup created before any write
  (`createOldMigrationBackup`), and a same-contact check that both the old *and* new number are present
  before removing the old one (`removeOldDuplicates`, `contactsService.ts:571-577`) — so the new number
  is guaranteed to remain. It never deletes a whole contact or unrelated numbers; it operates strictly
  on the recorded old/new pair. No logic changes were needed here — this part was already correct.

### 1.4 Settings / About / diagnostics wording

- [`app/settings.tsx`](apps/mobile/app/settings.tsx): renamed "About" → **"Rules & About"**, now showing
  rule source ("PURA-guided migration rules"), last rule update date (from the locally cached published
  rules payload), active rule count, app version, and build number (added `buildNumber` to
  [`deviceService.ts`](apps/mobile/src/services/deviceService.ts) via `expo-application`'s
  `nativeBuildVersion`).
- Removed "Admin Published" (was a hardcoded `InfoRow`).
- Reworded the "Support diagnostics" notice card to state plainly what is/isn't collected without
  enumerating raw server-side field names; renamed the "Show Diagnostics" button/dialog to "App Info".
- **Verified** (did not need to change): the support code shown to users is
  `SHA-256(device.id).slice(0,8)` server-side ([`devices.ts:39`](apps/api/src/routes/devices.ts)) — a
  one-way hash, not the raw device id, not an IP address, not a secret. `lastIp`/device model/OS are
  only ever returned from the **admin-only** `/admin/devices` route, never from the mobile-facing
  `/devices/register` or `/devices/:fingerprint/status` responses, so the app never even receives its
  own IP back. This already matches the "must not expose a device identifier ... IP address" requirement.

### 1.5 Dashboard spacing

- [`app/dashboard.tsx`](apps/mobile/app/dashboard.tsx): the free-access `NoticeCard` immediately after
  the "More tools" section had **no top margin at all**, sitting flush against the button row above it —
  this was the concrete cause of the reported crowding. Wrapped it in a `marginTop: 18` container
  (matching the app's existing `Section` spacing convention) and increased the bottom privacy line's
  top margin from 14 to 18.
- Replaced the remaining "Admin controlled" cleanup-metric helper text with "Availability scheduled".

### 1.6 Notifications

- Searched the whole repo (source and DB seeds/migrations) for literal junk content (`START_ALL.bat`,
  debug strings, etc.) — **none found** in this codebase snapshot; the admin notification composer has
  no seeded test data.
- Verified existing safeguards: `requireAdmin`-gated, `zod`-validated (title 2–80 chars, message 2–500
  chars), audience/target controls, per-device delivery ticket + receipt tracking, invalid-token
  deactivation. These were already solid.
- **Added**: server-side sanitization (`sanitizeNotificationText` in
  [`notifications.ts`](apps/api/src/routes/notifications.ts)) stripping HTML/script tags and collapsing
  embedded newlines/tabs before a notification is stored or sent. Neither the mobile client (plain RN
  `<Text>`) nor the admin portal (no `dangerouslySetInnerHTML` anywhere) currently renders this as HTML,
  so this is defense in depth rather than a fix for an active injection path — it closes the gap if
  either surface changes later. 8 new tests in
  [`notification-sanitization.test.ts`](apps/api/tests/notification-sanitization.test.ts).
- **Not done**: duplicate-notification suppression (sending the same title/message twice in a short
  window) — flagged as a possible follow-up, not implemented this pass.

### 1.7 Free launch / payments (verified, no changes needed)

`app/payment.tsx` already branches on `EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'store'`: store builds
render `StoreFreeLaunchAccess` (shows "Free launch access active" / "Access active", never "Payment
confirmed") and never import or render `PaymentCheckout` (the Wave/APS/test-OTP flow), which stays
reachable only in non-store builds. This already matches the required behavior; nothing was changed.

### 1.8 Dependency / security audit

`pnpm audit --audit-level=high` before this pass: **10 vulnerabilities (1 critical, 3 high, 6
moderate)**. After upgrading `vitest` 2.1.9 → 3.2.7 across every package (root, `apps/admin`,
`apps/api`, `apps/mobile`, `apps/web`, `packages/shared`) and reinstalling:

- **Critical fixed**: `vitest` arbitrary file read/execute when the Vitest UI server is listening
  (GHSA-5xrq-8626-4rwp).
- **High fixed**: `vite` `server.fs.deny` bypass on Windows, pulled in transitively by vitest
  (GHSA-fx2h-pf6j-xcff).
- All 109 tests across the monorepo pass unchanged on the new major version — no code changes were
  needed for the upgrade.

**Remaining, not fixed** (`pnpm audit --audit-level=high` now reports 5: 2 high, 3 moderate):

- `image-size` (2 high, DoS via malformed ICNS/JXL/HEIF) — pulled transitively by Expo SDK 54's Metro
  bundler (`expo > @expo/cli > metro > image-size`). This is a build-time-only dependency (not shipped
  in the app bundle or the API server), and no patched version exists yet upstream
  (`Patched versions: <0.0.0`). Track for a future Expo SDK update.
- `react-router` (2 moderate: open-redirect via backslash in `<Link>`/`useNavigate`, and an SSR-hydration
  constructor-injection issue) — used by `apps/admin` and `apps/web` via `react-router-dom@6.30.5`. The
  fix requires `react-router-dom` **v7**, a breaking major-version migration (new data APIs, changed
  routing config) that was out of scope to do safely in this pass. Recommend scheduling as its own
  reviewed change.
- `uuid` (1 moderate, missing buffer bounds check in v3/v5/v6 when a buffer is supplied) — the project
  does not call the affected v3/v5/v6 buffer-argument APIs directly; low practical risk, tracked.

Also verified (no changes needed, already correct):
- [`env.ts`](apps/api/src/config/env.ts) already refuses to start in production with a placeholder JWT
  secret, `PAYMENT_TEST_MODE=true`, an out-of-range webhook tolerance, or a `localhost` CORS origin.
- [`seed.ts`](apps/api/src/scripts/seed.ts) already refuses to seed an admin with a short or
  placeholder-looking password.
- No `dangerouslySetInnerHTML`/`v-html`/raw `innerHTML` anywhere in `apps/admin`.

### 1.9 Release configuration (spot-checked, already correct)

`apps/mobile/app.json`: app name `GNM`, Android package `com.oceanbrown.gambianumbermigrator`, iOS
bundle ID `com.oceanbrown.gambianumbermigrator`, public version `1.0.0`, EAS project ID matches
`.env.example`, splash screen already configured with light/dark image + background variants. No
changes made here.

## 2. Test results (actually executed)

```
pnpm typecheck   → apps/admin, apps/api, apps/mobile, apps/web, packages/shared — all pass, 0 errors
pnpm test        → 6 test files, 110 tests, 0 failures
                     packages/shared:  18 tests (ruleEngine, incl. 100k-contact perf test + cleanup-key regression)
                     apps/web:          6 tests (NumberChecker)
                     apps/admin:        7 tests (Layout)
                     apps/mobile:      41 tests (unlockService, operationService, storage*, contactsService*)
                     apps/api:         38 tests (device-secret, operators-rbac, website-rbac, health, notification-sanitization*)
                     (* = new this pass, 19 + 8 + 1 = 28 of the 110 are new)
pnpm audit --audit-level=high → 10 → 5 vulnerabilities (critical + 1 high resolved; see §1.8)
```

**Not executed** (see §7 for why and the residual risk):
- `db:verify-migrations` — the new migration-verification script — no reachable PostgreSQL server in
  this environment (Docker Desktop's Windows service was stopped and could not be started without
  elevated privileges this session had no way to grant). The script is written, registered as
  `pnpm --filter @gnm/api db:verify-migrations`, and ready to run against the existing
  `docker-compose.yml` Postgres service.
- `pnpm --filter @gnm/admin build` / `pnpm --filter @gnm/web build` (production Vite builds) — not run
  this pass; typecheck passed for both, which is a weaker signal than an actual build.
- `expo doctor`, `eas build` (Android AAB / iOS IPA) — no Expo/EAS credentials or a macOS/EAS build
  environment available here.
- Any on-device manual test (the 30-item acceptance checklist in the original request) — no physical
  Android/iOS device or emulator available in this environment.

## 3. Files changed this pass

**Mobile**
- `apps/mobile/src/services/storage.ts` — checksum, refuse-empty-backup guard
- `apps/mobile/src/services/contactsService.ts` — restore rewrite, conflicting-operation lock, permission guards
- `apps/mobile/src/services/deviceService.ts` — added `buildNumber`
- `apps/mobile/app/backup.tsx` — restore progress/completion wiring, dead-code fix, retention notice
- `apps/mobile/app/restore-complete.tsx` — **new**
- `apps/mobile/app/dashboard.tsx` — spacing fix, wording fix
- `apps/mobile/app/settings.tsx` — Rules & About section, diagnostics wording
- `apps/mobile/app/cleanup.tsx` — wording + explanation card
- `apps/mobile/src/services/storage.test.ts` — **new**
- `apps/mobile/src/services/contactsService.test.ts` — **new**
- `apps/mobile/package.json` — version, vitest bump

**API / database**
- `database/migrations/020_payments_device_fk.sql` — idempotency fix
- `apps/api/src/scripts/verify-migrations.ts` — **new**
- `apps/api/src/routes/notifications.ts` — sanitization
- `apps/api/tests/notification-sanitization.test.ts` — **new**
- `apps/api/package.json` — new script, version, vitest bump

**Workspace-wide**
- `package.json`, `apps/admin/package.json`, `apps/web/package.json`, `packages/shared/package.json` —
  version bump, vitest bump
- `CHANGELOG.md` — this pass's entry
- `FULL_AUDIT_2026-08-26.md` — this file

## 4. Environment variables (reference, no real values)

See `.env.example` at the repo root — unchanged this pass. Production must set real values for
`DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET` (32+ random chars), `ADMIN_INITIAL_PASSWORD` (12+
chars, no placeholder pattern), and set `PAYMENT_TEST_MODE=false`, `CORS_ORIGIN` to the real admin
origin — `env.ts` already refuses to boot otherwise. No secrets are present anywhere in this archive.

## 5. Rollback

- **Database**: every migration in this pass is additive/idempotent (`020`'s fix only changes *how* the
  same FK gets added, not the resulting schema). No destructive migration was added or changed. Standard
  `pg_dump` before running `db:migrate` in production remains the recommended safety net; this pass
  didn't change that guidance.
- **Mobile**: all storage changes are backward-compatible reads — `backupChecksum` is optional on older
  stored records (`if (backup.checksum && ...)` guards), and `targetedRestorePhones` falls back to a
  full-snapshot restore if a contact currently has zero numbers. Reverting is a plain code rollback
  (`git revert` / restoring the previous `apps/mobile` sources); no local-storage migration is required
  in either direction.
- **API**: `notifications.ts` and `verify-migrations.ts` changes are additive; reverting is a plain code
  rollback with no data implications.

## 6. Android / iOS release checklist status

| Item | Status |
|---|---|
| App name `GNM`, package/bundle ID `com.oceanbrown.gambianumbermigrator`, version `1.0.0` | ✅ already correct in `app.json` |
| EAS project ID set | ✅ already correct |
| Splash screen (light/dark, no stretch) configured | ✅ already correct via `expo-splash-screen` plugin config — **not visually re-audited this pass** |
| Store build hides Wave/APS/test-OTP | ✅ verified, already correct |
| Production API URL | ⚠️ not verified this pass — confirm `EXPO_PUBLIC_API_BASE_URL=https://api.oceanbrown.gm/api` is set in the actual EAS build profile/secrets, not just `.env.example` |
| Android AAB / iOS IPA build | ❌ not attempted — requires EAS credentials and (for iOS) an Apple developer account/macOS or EAS cloud build, unavailable here |
| Device/TestFlight testing | ❌ not attempted — no physical device or emulator available here |
| Play Console / App Store Connect listing readiness | ❌ not assessed this pass |

## 7. Remaining limitations / what this pass did not cover

Be explicit about what "done" means here — none of the following were completed, and none should be
assumed done from this report:

- **Not source-audited this pass**: the full mobile UI/UX pass across every remaining screen (onboarding,
  scan/migration progress, history, notifications list, splash visual QA, dark-mode contrast, dynamic
  font scaling, screen-reader labels) — only the screens named with concrete, verifiable complaints
  (dashboard, cleanup, settings, backup) were touched. The admin portal (login, rule publishing, campaign
  controls, devices/payments views, RBAC) was spot-checked for the contact-privacy and default-credential
  concerns only, not exhaustively reviewed.
- **Not executed**: `db:verify-migrations` (no reachable Postgres — Docker Desktop's Windows service
  couldn't be started without elevated privileges in this session), production Vite builds for
  admin/web, `expo-doctor`, `eas build`, Docker Compose bring-up end to end.
- **Not tested on a device**: none of the 30 manual acceptance scenarios in the original request (fresh
  install, permission grant/deny flows, dark/light mode, small-screen layout, etc.) were run, because no
  physical Android/iOS device or emulator was available in this environment.
- **Not migrated**: `react-router-dom` v6→v7 (moderate CVEs, needs a dedicated reviewed change — see §1.8).
- **Not implemented**: duplicate-notification suppression.

### Distinguishing "done" per the acceptance criteria

- **Source-code complete**: for the scope in §1 only — not the full original request.
- **Automated tests passed**: yes, for everything this pass touched (109/109, including 27 new tests) —
  see §2 for exact commands.
- **Android device tested / iOS device/TestFlight tested**: no.
- **VPS verified**: no.
- **Play Console ready / App Store Connect ready**: not assessed.
