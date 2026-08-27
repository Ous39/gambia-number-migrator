# Changelog

## GNM — 2026-08-27 (Wave Checkout integration)

Full Wave payment-integration audit plus a production-ready implementation. See
`WAVE_INTEGRATION_AUDIT.md`, `WAVE_ONBOARDING.md` and `WAVE_DEPLOYMENT_AND_ROLLBACK.md`.
**Ships disabled** — live Wave is blocked in code until Wave confirms GMD support and issues
production credentials.

**Backend**
- New provider layer `apps/api/src/services/payments/` (`types.ts`, `signature.ts`, `httpRetry.ts`,
  `waveProvider.ts`, `apsProvider.ts`, `index.ts`) behind a clean `PaymentProvider` interface.
  APS keeps its own separate interim signature/event scheme.
- `waveProvider` calls the real Wave Checkout API: `POST /v1/checkout/sessions` with
  `Authorization: Bearer` + `Wave-Signature: t=,v1=` request signing (HMAC-SHA256 over
  `` `${unixSeconds}` + rawBody ``, exact serialized body reused). `GET /v1/checkout/sessions/:id`
  for reconciliation. Outbound timeout + exponential backoff for 429 / transient 5xx.
- `routes/payments.ts` rewritten: `create-intent` creates a Wave session and returns
  `wave_launch_url`; server is the sole price authority. New `/payments/webhook/wave` verifies the
  real `Wave-Signature` (multi-`v1` rotation, 300 s past / 30 s future, timing-safe), parses
  `{id,type,data}`, dedups on `event.id`, validates amount/currency/`client_reference`, requires
  `payment_status=succeeded` + `checkout_status=complete`, and unlocks only the payment's own
  device via a monotonic state machine (a `success` can never be downgraded). `/payments/webhook/aps`
  kept separate. `:reference/status` reconciles a stale pending payment straight from Wave.
- `config/env.ts`: `WAVE_API_BASE_URL/API_KEY/API_SIGNING_SECRET/WEBHOOK_SECRET[_PREVIOUS]/CURRENCY/`
  `SUCCESS_URL/ERROR_URL/REQUEST_TIMEOUT_MS/WEBHOOK_TOLERANCE_SECONDS` + `waveConfigHealth()`.
  Production boot fails if `PAYMENT_PROVIDER_INTEGRATION_READY=true` and Wave config is incomplete;
  Wave *disabled* never blocks boot.
- `routes/appConfig.ts`: `wave_payment_enabled`/`aps_payment_enabled` can only be switched on when
  the backend proves it is safe (test mode off, integration ready, credentials present, currency
  matches, HTTPS). New read-only `GET /admin/payments/health` (never returns secrets).
- `app.ts`: dropped the obsolete generic `X-Webhook-*` CORS headers.

**Database**
- `database/migrations/025_wave_checkout_fields.sql` — forward-only, idempotent, no drops/deletes.
  Adds `wave_checkout_session_id`, `wave_transaction_id`, `client_reference`, `internal_reference`,
  `checkout_status`, `payment_status`, `last_provider_error_code/message`, `webhook_event_id`,
  `provider_metadata_json`, `expired_at`; `payment_webhook_events.event_type`; backfills existing rows.

**Mobile**
- `app/payment-checkout.tsx` — live checkout now opens `wave_launch_url` in the **system browser**
  (`Linking.openURL`, never a WebView) and a new `processing` step polls the protected status
  endpoint; access unlocks only on a server-confirmed `success`. The local test-OTP UI is shown
  only when the API returns a `testOtp` (test mode). Price fallback D100 → D25. Store builds
  unchanged (free-launch, no Wave).

**Admin**
- Payments page shows a provider-configuration health panel (`configured` / `missing` / currency /
  key tail — no secrets) and hides "Confirm test" outside test mode.

**Tests**
- `apps/api/tests/wave-signature.test.ts` (12), `payments-route.test.ts` (11),
  `secrets-hygiene.test.ts` (3). `pnpm typecheck`, `pnpm test`, `pnpm build` all green.

## GNM 1.0.0 — 2026-08-27 (release-identity, store-policy audit, campaign audit trail, header consolidation)

Full production-readiness pass for Google Play Internal Testing, Apple TestFlight and Contabo VPS deployment. See `GNM-v1.0.0-FINAL-AUDIT.md` for the complete report, `GNM-v1.0.0-VPS-DEPLOYMENT.md`, `GNM-v1.0.0-GOOGLE-PLAY-INTERNAL-TESTING.md` and `GNM-v1.0.0-APPLE-TESTFLIGHT.md` for store/deployment procedures.

**Release identity**
- Renamed the Android package and iOS bundle identifier from `com.oceanbrown.gambianumbermigrator` to `gm.oceanbrown.gnm` everywhere in source and docs. Confirmed via full-tree grep that no reference to the old identifier remains.
- Bumped Android `versionCode` 40→41 and iOS `buildNumber` 39→40 as a conservative floor, since the identifier change makes this a new app identity on both stores with no queryable prior history from this environment — confirm against the real EAS/store console before submitting.
- Removed the stale `apps/mobile/google-services.json`, which was registered to the old package name and would have failed the Android production build outright. Local (on-device) completion notifications are unaffected; remote push-token registration already failed gracefully without it and will resume once a fresh Firebase config for `gm.oceanbrown.gnm` is added.

**TypeScript gate**
- Fixed the two `pnpm typecheck` errors in `contactsService.test.ts` (`Type '{...}' is not assignable to type 'never'`), caused by an untyped mock (`getContactsAsync`) whose empty-array return inferred as `never[]`. Fixed with a proper `MockDeviceContact` type annotation — no `@ts-ignore`, no `any`, no relaxed strictness, no excluded/removed tests. `pnpm typecheck` now passes with zero errors across all five packages.

**Campaign access audit trail**
- Audited the free-access campaign assignment logic (`apps/api/src/routes/devices.ts`) and confirmed it was already concurrency-safe (Postgres advisory transaction lock) and idempotent (unique device id + grant-timestamp `COALESCE`) — not a rebuild, a verification.
- Found and fixed one real gap: automatic campaign grants during device registration were not audit-logged (only admin-initiated actions were). Added an `audit()` call recording the grant, mode and slot count.
- Found and fixed a second gap: the Admin portal didn't surface when the campaign config was last changed or by whom, despite that data already existing (`app_config.updated_at`, `audit_logs`). `GET /admin/free-access-stats` now returns `configLastChangedAt`/`configLastChangedBy`, displayed in the Admin App Config page.
- Documented, not fixed: reinstall-abuse resistance is currently limited to per-IP rate limiting (no hardware device attestation) — this was already an honestly-disclosed `TODO` in the code and remains disclosed rather than silently accepted or oversold.

**Store-policy payment gating — audited, confirmed correct**
- Verified (not rebuilt) that `store`-channel builds unconditionally bypass Wave/APS checkout in favor of a payment-free "Free Launch Access" screen, regardless of any Admin toggle — this cannot be re-enabled by an Admin flipping a setting, because the store build's code path never reaches the checkout screen.

**Mobile header system**
- Audited all 16 mobile screens against the shared `TopNav`/`BackHeader` component in `apps/mobile/src/components/UI.tsx`. Found one real inconsistency — `dashboard.tsx` reimplemented its own header instead of using the shared component — and consolidated it, preserving its exact visual appearance.
- Extended `TopNav`/`BackHeader` with an overridable `eyebrow` line (previously hardcoded), and `loading`/`disabled` state support, which the spec explicitly required and which didn't exist before.
- Fixed `IconButton`'s accessibility labeling (previously defaulted to the raw icon name, e.g. "left" instead of "Go back") and added a `disabled` state.
- Widened the header title from a hard 1-line truncation to 2 lines with `flexShrink`, so long titles wrap instead of being cut off; no visual change for any of the app's current (short) titles.

**Data deletion**
- Added a public `/data-deletion` page to the website (`apps/web/src/pages/DataDeletion.tsx`), linked from the site footer and Privacy Policy, explaining exactly what server-side data GNM retains (device metadata, payment records, push tokens — never contact data) and how to request its deletion.

**VPS / Docker**
- Added missing `healthcheck` blocks for the `api`, `admin` and `web` services in `docker-compose.production.yml` (only `postgres` had one before), and made `admin`/`web` wait on the API's health rather than an unconditional dependency.

**Verification performed**
- `pnpm typecheck`: zero errors, all 5 packages.
- `pnpm test`: 112 tests passing across shared/mobile/api/admin/web.
- `pnpm --filter @gnm/web build`: clean production build, spot-verified live in a local browser preview.
- Database migrations 001–024, API security posture, and VPS Docker/Nginx configuration each independently audited read-only; findings and any fixes are detailed in `GNM-v1.0.0-FINAL-AUDIT.md`.
- Not verified from this environment (no device/simulator, no Docker daemon, no reachable production Postgres, no EAS/Apple/Google credentials, no live VPS): actual EAS cloud builds, live device rendering, Docker Compose execution, and store submission. See `GNM-v1.0.0-FINAL-AUDIT.md` §14 for the full release-gate table distinguishing verified from not-verified.

## GNM 1.0.0 / Source 2.11.0 — 2026-08-26 (continued: duplicate-key crash on device)

**Cleanup screen still showing "Encountered two children with the same key" after the previous fix**
- Root cause: the previous fix added `phoneIndex` to newly generated cleanup candidates, but a scan
  saved to the device *before* that fix (`AsyncStorage` key `gnm_scan`) has no `phoneIndex` field at all.
  Reloading the JS bundle does not regenerate that cached data, so the exact same duplicate-key warning
  reappeared on real devices that had scanned once before updating. Two changes close this for good:
  1. `apps/mobile/app/cleanup.tsx`: the FlatList key is now built from the item's position in the
     rendered list in addition to its content (`cleanupKey(item, index)`), so it can never collide
     regardless of what shape the underlying data happens to be in.
  2. `apps/mobile/src/services/contactsService.ts`: added `SCAN_SCHEMA_VERSION`, stamped onto every scan
     result. Dashboard, Cleanup and Preview now all treat a saved scan whose `schemaVersion` doesn't match
     the current one as stale (the same way an outdated `rulesVersion` is already handled) and prompt a
     rescan instead of silently reusing candidates that predate the `phoneIndex` field. This is the
     general fix — it also protects the migration Preview screen (`candidateKey`), which had the identical
     dependency on `phoneIndex` but couldn't safely use the same index-based key as Cleanup, since its
     selection state is tracked across three different filtered views of the same scan.
- New regression tests in `contactsService.test.ts` assert every saved scan carries the current
  `schemaVersion`, and that cleanup candidates for a contact with two duplicate old-number phone rows
  always get distinct keys.

## GNM 1.0.0 / Source 2.11.0 — 2026-08-26 (continued: on-device feedback)

**Dashboard "Safe cleanup" card — pill text overflowing the card**
- Root cause: `MetricCard`'s header row (`Pill` + icon) had no width constraint on the pill, so a longer
  helper string (e.g. "Availability scheduled") overflowed past the card's right edge instead of
  shrinking or wrapping — reproduced on-device in both light and dark mode. Fixed at the component level
  (`apps/mobile/src/components/UI.tsx`): `Pill` now has `flexShrink: 1`, and `MetricCard`'s helper pill is
  wrapped in a `maxWidth: '55%'` container, so this is fixed everywhere `MetricCard`/`Pill` are used, not
  just the one card. Also shortened the dashboard cleanup-status text to "Scheduled" for extra margin.

**Empty-list screens (Cleanup, Backups, etc.) sitting flush against the bottom tab bar**
- `ListScreen`'s `ListEmptyComponent` had no bottom padding of its own, relying on the `footer` prop's
  padding, which isn't guaranteed to apply to every empty-state render path. Now the empty state always
  reserves `bottomPad` (the same clearance the tab bar itself expects) regardless of `footer`.

**Admin-editable Rules & About note**
- Added `rules_about_note` as a first-class field in the admin App Config page (Pricing card) and to the
  API's `app_config` allowlist/validation (500-char cap, matching `announcement_message`). When an admin
  sets it, it now shows as an extra notice card under Settings → Rules & About on the mobile app; left
  blank, nothing extra renders. This is in addition to (not instead of) the already-live "Rule source" /
  "Last rule update" / "Active rules" fields, which were already correctly driven by whatever rules the
  admin has published — those needed no change.

## GNM 1.0.0 / Source 2.11.0 — 2026-08-26

Full backup/restore, privacy-wording and security audit pass. See `FULL_AUDIT_2026-08-26.md` for the complete report.

**Backup & restore (priority fix)**
- Backups now carry a real content checksum (`backupChecksum`, cyrb53), verified at write time and on every read. Previously only the chunk item *count* was checked, so a corrupted chunk with the right length passed silently.
- `restoreBackup` no longer blind-overwrites a contact's entire phone array when reversing a migration/cleanup backup. It now reverses only the specific old/new number pair that was changed (`targetedRestorePhones`), so a number the user added to that contact after the backup was taken is preserved instead of silently dropped.
- Restore failures now record a reason per contact (`failureDetails`) instead of being swallowed into an opaque failed-count.
- Added a device-side lock: migration, cleanup, backup and restore each refuse to start while another of the four is still `running`, closing a race where a restore and a migration could write to contacts concurrently.
- Restore now checks/requires contacts permission before writing, matching every other mutating operation.
- Restore is now tracked through `operationService` with a live progress bar on the Backups screen and a new dedicated `/restore-complete` summary screen (restored/skipped/failed + backup ID), matching the existing backup-complete flow. Previously restore had no progress UI and only an inline dialog.
- Fixed dead code on the Backups screen reading `item.items?.length` (always `undefined` post-storage-v2); it now reads `item.itemCount`.
- The Backups screen now discloses the 30-backup rolling retention limit up front instead of evicting older backups silently.
- Added 19 new automated tests covering backup persistence/chunking/checksum corruption detection, and restore reversal, duplicate prevention, permission/lock guards and partial-failure handling (`storage.test.ts`, `contactsService.test.ts`).

**Database migrations**
- Fixed `020_payments_device_fk.sql`: `ALTER TABLE ... ADD CONSTRAINT` is not idempotent in PostgreSQL and failed if the FK already existed (e.g. reapplied, or added out-of-band before `schema_migrations` recorded it). It now checks `pg_constraint` first inside a `DO $$` block.
- Added `apps/api/src/scripts/verify-migrations.ts` (`pnpm --filter @gnm/api db:verify-migrations`), which runs the full migration set against disposable scenario databases covering: clean install, rerun/no-op, constraint-present-but-unrecorded (the 020 bug), and an upgrade path with a pre-existing orphaned payment row.

**Privacy wording**
- Removed "Admin controlled" (Dashboard cleanup metric) and "Cleanup controlled by Admin" (Cleanup screen) — replaced with "Availability scheduled" / "Availability schedule", plus an explicit on-screen explanation that cleanup runs entirely on-device and administrators cannot view, access or delete contacts.
- Removed "Admin Published" (Settings → About) — replaced with a new "Rules & About" section showing rule source ("PURA-guided migration rules"), last rule update date, active rule count, app version and build number.
- Reworded the Settings "Support diagnostics" notice to state plainly what is/isn't collected, without enumerating raw server fields; renamed "Show Diagnostics" to "App Info".

**Notifications**
- Admin-authored notification title/message are now sanitized server-side (`sanitizeNotificationText`): HTML/script tags stripped, embedded newlines/tabs collapsed. Defense in depth — neither the mobile client (plain RN `<Text>`) nor the admin portal render this as HTML today, but this closes the gap if either ever does.

**Dashboard**
- Fixed insufficient spacing between the "More tools" section and the free-access notice card below it (no top margin previously); also increased spacing before the closing privacy line.

**Cleanup screen — duplicate list key (found via live dev-server logs)**
- `findCleanupCandidates` (`packages/shared/src/migration.ts`) generated one cleanup candidate per old-number phone row but never disambiguated by which row it came from. A contact with the exact same 7-digit number saved twice (a real, reachable case — duplicate/synced contact entries) produced two candidates with an identical `contactId:oldNumber:newNumber` key, which React Native's `FlatList` surfaced as a live "Encountered two children with the same key" warning/duplication risk on the Cleanup screen. Added `phoneIndex` to `CleanupCandidate` (mirroring the field `generateMigrationCandidates` already carries) and included it in the Cleanup screen's list key. New regression test in `packages/shared/tests/ruleEngine.test.ts` reproduces the exact scenario and asserts unique keys.

**Dependencies**
- Upgraded `vitest` 2.1.9 → 3.2.7 across all packages, resolving a critical arbitrary-file-read/execute advisory (GHSA-5xrq-8626-4rwp) and a high-severity Vite path-bypass advisory pulled in transitively. All 109 existing + new tests pass unchanged on the new major version.
- Remaining known-vulnerable dependencies (tracked, not fixed in this pass): `image-size` (2 high, DoS via malformed ICNS/JXL/HEIF; transitively pulled by Expo/Metro's bundler, build-time only, no upstream fix published yet) and `react-router` (2 moderate, open-redirect/SSR-hydration; fix requires a react-router-dom v6→v7 major migration in `apps/admin` and `apps/web`, out of scope for this pass).

## GNM 1.0.0 / Source 2.8.15 — 2026-08-22

- Set the App Store and Google Play display name to **GNM**.
- Prepared the first public mobile release as version `1.0.0` with incremented native build identifiers.
- Replaced the unfinished store-purchase placeholder with a complete Free Launch Access experience.
- Added migration `019_free_store_launch.sql` to enable free access for everyone, set the reference price to D25, disable Wave/APS visibility and publish the launch announcement.
- Preserved Wave/APS testing only for direct development builds pending approved production integrations.
- Added device-secret possession checks, legacy-device soft migration and payment/device referential integrity.
- Enforced operator-management RBAC and corrected support-role device access.
- Added registration/status throttling and removed automatic production reseeding.
- Replaced the fallback UUID generator with `expo-crypto`.
- Strengthened production placeholder-secret rejection and fresh local setup secret generation.
- Corrected Windows launchers so setup returns from pnpm, repairs incomplete local environment files, generates missing secrets and advertises the LAN address to physical phones.
- Added the missing production Compose stack and patched compatible vulnerable transitive dependencies.
- Consolidated project documentation and removed obsolete audits, generated screenshots and unused assets.
