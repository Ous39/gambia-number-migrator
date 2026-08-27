# Changelog

<<<<<<< HEAD
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
=======
## 2.8.9 - 2026-08-20

- Fixed failed and skipped contact writes consuming free trial allowance.
- Fixed selected contacts disappearing when Preview filters changed.
- Added per-contact native write failure details to migration results and local history.
- Added an audited Admin action to reset incorrectly consumed trial usage on affected test devices.
- Advanced Android versionCode and iOS buildNumber to 34.

## 2.6.2 - 2026-07-21

- Added dedicated Android and iOS keyboard avoidance to payment checkout.
- Collapsed the large checkout hero and progress tracker while typing so the active phone or OTP field remains visible on small displays.
- Retained Android resize mode and iOS automatic keyboard insets for reliable behavior across keyboard implementations.

## 2.6.1 - 2026-07-21

- Redesigned the checkout phone input for clearer mobile-wallet payment entry.
- Correctly normalizes pasted `+220` and `00220` Gambian numbers instead of truncating them.
- Added focus, validation, clear/reset, telephone autofill and keyboard-submit behavior.
- Fixed Android keyboard overlap with resize mode and scroll-to-dismiss behavior.

## 2.6.0 - 2026-07-21

- Redesigned the Wave/APS purchase flow to follow the supplied four-step reference while preserving the OceanBrown purple theme.
- Hid Full Unlock after the server confirms paid access and added clear trial/paid status on Dashboard.
- Enforced a server-backed 10-contact free migration limit and automatically limited free Preview selections.
- Restricted manual Backup/Restore, Replace, and Cleanup to paid devices while retaining automatic safety snapshots before permitted migrations.
- Made backup creation transactional, removed partial chunks on failure, and verified restored phone data after each device write.
- Added visible notification setup status and retry controls, stricter push-token validation, old-token deactivation, and admin push error details.
- Added conditional Android Firebase configuration: `google-services.json` is included automatically when provisioned without committing it.
- Corrected app/device version reporting and refreshed production documentation.

## 1.9.4 - 2026-07-14

- Corrected shared button typography for iOS font metrics, accessibility scaling and longer labels.
- Added privacy-safe support codes and shareable user diagnostic summaries.
- Added app version and last-seen network IP to the existing device support record.
- Added the Admin Support Devices workspace with payment reference, device/OS, last seen and support-code search.
- Added an audited Restore Paid Access action that requires an existing successful payment.
- Added migration `011_support_diagnostics.sql` and an in-app disclosure explaining support diagnostics.

## 1.9.3 - 2026-07-13

- Added explicit iOS permission requests for alerts, sounds and app-icon badges.
- Added active-priority iOS presentation and badge values to admin push payloads.
- Clear the notification badge after a user opens a notification on Android or iOS.
- Retained Android high-importance channel behavior for sound, vibration and lock-screen alerts.

## 1.9.2 - 2026-07-13

- Connected the mobile payment and checkout screens to the admin-managed `subscription_price` value.
- Added a first-class Contact Migration Pass price field and validation to App Configuration.
- Redesigned OTP verification as a focused, uncluttered payment confirmation step.
- Added a high-priority Android notification channel with sound, vibration, lock-screen visibility and badges.
- Added native push payload channel routing, admin delivery metrics and an Android notification preview.

## 1.9.1 - 2026-07-13

- Rebuilt the migration-complete summary as responsive result tiles and separated the backup reference from result totals.
- Reorganized Preview mode and selection controls so they remain readable on narrow Android screens.
- Refined the shared Android header spacing, hierarchy and divider treatment.
- Renamed the purchase to Contact Migration Pass and clearly excluded future products such as eSIMs, airtime and unrelated services.

## 1.5.0 - 2026-07-11

- Revalidated every selected migration pair against the current published rule ID before device writes.
- Required complete, verified live contact snapshots before add, replace, or cleanup can begin.
- Re-read contacts after every write and verified the expected old/new state.
- Preserved international `+220`, `220`, and `00220` number styles and fixed invalid-number equality.
- Added ambiguous-rule detection, exact two-digit migration-prefix enforcement, operator/rule prefix consistency, and transition configuration validation.
- Invalidated stale scan data after add, replace, cleanup, and restore.
- Made Cleanup opt-in, current-scan validated, payment-gated, and accurately reported.
- Added transactional one-time database migration tracking and stopped seed data from overwriting admin app configuration.
- Prevented successful payments from being downgraded, made OTP confirmation atomic, and enforced the configured D100 server price.
- Added migrations `009_migration_integrity_constraints.sql` and expanded regression tests.

## 1.4.0 - 2026-07-10

- Corrected Dashboard metrics, completion percentage, stale scan invalidation, no-scan navigation, and updated/review routing.
- Corrected scan summaries for contacts with multiple eligible numbers and added explicit review/unchanged totals.
- Made Preview default to no selection, added safe select-all-in-view behavior, separated Updated from Review, respected admin replace-mode control, and corrected completion totals.
- Removed false duplicate-risk detection caused by unrelated 9-digit numbers in the same contact.
- Disabled executable demo/fallback rules, retired auto-published sample versions, and added defense-in-depth checks requiring approved rules before scanning.
- Added seed-rule deduplication and aligned the pricing payload with D100.

## 1.3.0 - 2026-07-10

- Rebuilt local backups as verified, versioned 100-contact chunks to avoid Android per-entry storage failures.
- Added automatic migration of existing backup records, corruption checks, retention cleanup, and working deletion.
- Added admin notification composer, audience targeting, push delivery counts, audit records, mobile token registration, notification inbox, offline cache, and notification-tap navigation.
- Added database migration `004_notifications.sql` and Expo notification configuration.

## Stitch UI Refresh

- Reworked the mobile app theme system using the uploaded Stitch design language.
- Added stronger light and dark mode palettes.
- Updated splash, onboarding, dashboard, scan result, success, history, settings, and shared components.
- Preserved runtime fixes for Expo SDK 54 and React Native Web dependency.
- Added Stitch reference documentation in `docs/stitch/`.

# Changelog

## 1.0.0

- Initial production-ready monorepo structure.
- Mobile Expo app with onboarding, dashboard, scan, preview, add, replace, cleanup, backup, history, settings, and payment screens.
- Admin React panel with login, dashboard, operators, migration rules, testing, publishing, transition settings, payments, app config, and audit logs.
- Node/Express API with PostgreSQL schema, validation, auth, rules, settings, payments, config, audit, and health endpoints.
- Shared rule engine with normalization, detection, verification, migration candidates, and cleanup candidates.
- Docker Compose PostgreSQL.
- Windows run scripts.
- Documentation.

## 1.1.0 - Logic Merge Update

- Added privacy-safe device fingerprinting for payment/unlock flows.
- Added backend device registration and device status endpoints without storing contact data.
- Added premium feature gating for bulk add, replace, and duplicate cleanup.
- Improved scan performance with chunked progress updates for large phonebooks.
- Fixed selection tracking in Preview and Cleanup so filtering/searching cannot apply changes to the wrong row.
- Strengthened Duplicate/Add, Replace, Cleanup, and Restore phone matching using normalized Gambian local numbers.
- Re-verified duplicate cleanup against the current cached migration rules immediately before removing old numbers.

## 1.1.0 - UI refresh and SDK 54 mobile fix
- Rebuilt the mobile UI with a modern hero dashboard, action tiles, better scan progress, polished preview cards, and safer cleanup screen.
- Improved admin UI with a cleaner command-center layout, stronger cards, better sidebar, and modern table styling.
- Upgraded mobile package versions to Expo SDK 54 compatibility.
- Added dynamic LAN API detection so Expo Go on a real phone does not keep using `localhost`.
- Added friendly payment/network error handling to stop uncaught `Network request failed` logs.
- Updated Windows mobile start script to use Expo port 8082 and skip dependency validation when needed.

## 1.2.0 - Premium UI Refresh

- Rebuilt the mobile UI around the new premium navy/cyan design reference.
- Added global mobile theme provider with System, Light, and Dark modes.
- Redesigned Splash, Onboarding, Dashboard, Scan Complete, Preview Changes, Backups, Cleanup, Payment, Settings, History, and Completion flows.
- Added visual scan result and migration completion pages.
- Updated admin panel styling to match the premium design direction and added an admin light/dark toggle.
- Preserved privacy-first behavior: contact scanning and updates remain local only.

## 1.2.2 - Expo Runtime Fix

- Fixed mobile root layout runtime crash: `Element type is invalid ... RootLayout`.
- Made Expo Router root layout defensive for SDK 54 / Expo Router 6.
- Made mobile theme hook safe without requiring a root provider during initial render.
- Added runtime troubleshooting documentation.

## 2026-07-07 - Responsive App UI Fix

- Rebuilt the mobile UI to use responsive React Native layouts instead of fixed screenshot-like positioning.
- Added adaptive grid components, safe list screens, and scroll-safe actions.
- Improved dashboard, preview, cleanup, backups, history, settings, payment, onboarding, scan complete, and complete screens.
- Preserved light/dark/system theme support and Stitch-inspired design direction.


## 1.6.0 - UI audit, payment test flow, and preview selection safety
- Added payment provider selection UI for Wave, APS, and Manual/Mock test mode.
- Added professional in-app modal dialogs and removed native Alert usage from main mobile screens.
- Redesigned Settings and removed the Manage Data section.
- Made Dashboard top navigation fixed and removed extra top-nav icons.
- Improved Dashboard cards, spacing, and quick action layout.
- Fixed Preview filtering so operator selection displays and migrates only visible operator-specific numbers.
- Kept search/operator filters sticky and migration button always visible.


## Windows BAT runner update

This version includes improved BAT files for Windows:

- `RUN_THIS_FIRST.bat` - install and setup database
- `START_ALL.bat` - start API, Admin and Mobile together
- `START_API.bat` - start backend API only
- `START_ADMIN.bat` - start admin panel only
- `START_MOBILE.bat` - start Expo mobile app with LAN IP detection
- `START_MOBILE_TUNNEL.bat` - fallback Expo tunnel mode
- `FIX_PORTS.bat` - clear busy ports
- `STOP_ALL.bat` - stop project processes and Docker database

See `docs/BAT_RUN_GUIDE.md`.

## MansaPay Style UI + Migration Test Fix
- Applied a professional MansaPay-inspired blue/white mobile theme.
- Rebuilt dashboard header, hero, cards, quick actions, and spacing.
- Improved preview page with fixed search/operator controls and always-visible migration action.
- Operator filtering now limits selection/migration to the visible operator-specific list.
- Added test subscription unlock flow so migration can be tested before live payment integration.
- Added sticky top headers to standard mobile pages.
- Added documentation: docs/MANSAPAY_STYLE_UI_MIGRATION_FIX.md.

## 2026-07-08 — Audit patch and test-ready fixes

- Added local fallback migration rules payload for QCell, Comium, and Africell.
- Fixed Expo Contacts field usage to avoid unsupported `Contacts.Fields.Name`.
- Added manual full-contact local backup creation and restore support.
- Updated Preview filters with a dedicated Needs Update view for ready contacts.
- Fixed cleanup selection so actions apply to the current visible filtered list.
- Expanded payment test provider choices: Wave, APS, Card, Manual, and Mock.
- Made payment intent creation optional so local test unlock works even when API is offline.
- Added API `ADMIN_BASE_URL` for mock payment links and cleaned CORS origin parsing.
- Added transition fallback settings if the database is not seeded yet.
- Added/updated run, testing, admin, payment test, and audit documentation.

## 2026-07-08 - Follow-up Android UI, backup, payment, history fixes
- Removed  and  from the mobile payment test flow and shared payment validation schema.
- Improved Android-friendly dashboard spacing with a cleaner fixed header, compact hero summary, and safer card sizing.
- Made dashboard overview cards selectable: Total opens all preview records, Ready opens Needs Update, Already Updated opens review records, and Safe Cleanup opens cleanup.
- Added route-parameter support to Preview so dashboard overview selections open the correct filter.
- Added a real Backup Complete screen after manual backup creation instead of only showing a popup.
- Updated backup flow to navigate to the new completion screen while keeping contacts local-only.
- Redesigned inner page headers so the back button and page title are cleaner on Android.
- Upgraded History with summary cards, filters, status pills, success rate, and clearer scan/backup/migration/cleanup/restore records.


## Follow-up Fix - Payment OTP, Backup, Dashboard Overview
- Removed card/manual/mock providers from the mobile payment flow; only Wave and APS remain.
- Added a Wave/APS checkout screen with amount display, phone-number entry, Pay D100 button, 4-digit test OTP, OTP confirmation, and success unlock.
- Updated the saved scan after successful duplicate-add or replace migrations so Dashboard Overview counts refresh correctly.
- Improved Dashboard Overview navigation to open the correct Preview filter.
- Improved manual backup creation with loading state and a dedicated Backup Complete route.

## 2026-07-09 - Payment number validation and old migration backup

- Payment checkout now accepts only 7-digit or 9-digit phone numbers for Wave/APS test payments.
- Extra payment phone digits are trimmed and the user sees a clear validation message.
- Migration operations now create an old migration backup before changing contacts.
- Old migration backups store the contact phone-number snapshot before add, replace, or cleanup.
- Backup restore now prefers the exact saved phone-number snapshot, making rollback safer.
- Backup list now labels old migration backups clearly and allows restore from older backup records too.
- Migration Complete now shows the old migration backup ID and links to the Backups page.

## 2026-07-09 - Backup loading, payment UI, and API fallback audit

### Fixed
- Reworked the Backups screen so manual backup now has a full progress card, percent bar, spinner, disabled restore actions during backup, and a clearer `Creating Backup...` button state.
- Manual backup now passes scan progress from the contacts service, so users see progress similar to migration/scan flows instead of only a small header button loading state.
- Improved Wave/APS checkout phone-number input styling with a provider icon, +220 label, digit counter, stronger border states, and clearer valid/error feedback.
- Improved the `Pay D100` button styling on the checkout screen with larger touch target, provider-colored enabled state, and disabled visual state.
- Confirmed payment providers remain Wave and APS only in the mobile UI and shared schema.
- Added API fallbacks for public mobile config routes when PostgreSQL is temporarily down: `/api/migration-rules`, `/api/transition-settings`, and `/api/app-config` now return safe local test defaults instead of 500 errors.
- Improved `/api/health` so it reports `database: disconnected` when PostgreSQL on port 5434 is not reachable while still confirming that the API service itself is running.
- Updated `START_API.bat` and `START_ALL.bat` to start Docker PostgreSQL, wait for readiness, and run safe migrations/seed before launching services.

### Notes
- Admin login still requires PostgreSQL because admin accounts are stored in the database.
- Mobile contact processing remains local-only; no full contact list is sent to the API.

## 2026-07-09 - Full audit, professional payment redesign, and Docker-safe startup

### Fixed
- Redesigned the mobile payment selection page to look more professional, with a premium hero, plan summary, modern Wave/APS provider cards, checkout summary, and polished call-to-action area.
- Redesigned the Wave/APS checkout page with a professional amount hero, step tracker, upgraded phone-number field, OTP boxes, receipt-style success page, and clearer validation messages.
- Confirmed mobile payment remains Wave and APS only.
- Confirmed payment phone numbers are limited to 7 or 9 digits, with extra digits trimmed at 9.
- Updated `START_ALL.bat` and `START_API.bat` so they no longer run migrations/seed when Docker Desktop is installed but the Docker engine is not running.
- Updated `RUN_THIS_FIRST.bat` and `RESET_DATABASE.bat` with explicit Docker Desktop running checks and safer PostgreSQL readiness checks.
- Updated `STOP_ALL.bat` so it does not throw Docker pipe errors when Docker Desktop is closed.

### Why
- The previous startup script saw Docker installed, tried to run `docker compose`, then continued into migrations even though Docker Desktop was not running. This caused repeated `ECONNREFUSED` errors on PostgreSQL port 5434.
- The payment page worked functionally but did not look production-ready enough for user testing.
- Improved API error handling for database-down admin routes. Admin login now returns a clearer database unavailable message instead of a generic internal server error.
## 1.6.0 - 2026-07-11

- Redesigned the full mobile experience around a trust-first Gambian green and deep-navy visual system.
- Improved hierarchy, contrast, spacing, card density, inputs, buttons, navigation and responsive tablet behavior.
- Reworked the five-tab mobile navigation so every destination has a persistent text label.
- Redesigned the admin console shell, icons, tables, forms, status surfaces, login screen and mobile breakpoints.
- Added consistent light/dark themes and visible keyboard focus states without changing audited migration logic.
- Updated app metadata, notification accent color and release labels to v1.6.0.
## 1.7.1 - 2026-07-11

- Added `STOP_ALL.bat` to close the named API, Admin and Expo windows and stop local PostgreSQL without deleting data.
- Made first setup automatically create `.env` from `.env.example` when missing.
- Added setup-completion guards to every Windows launcher.
- Made `START_ALL.bat` open the Admin dashboard automatically and show the detected LAN API address.
- Documented the one-click local testing workflow.

## 1.7.0 - 2026-07-11

- Added production app icon, Android adaptive icon, splash artwork and favicon assets.
- Added accessible in-app WhatsApp, email, phone, privacy-policy and terms actions driven by public app configuration.
- Rebuilt Admin App Config as a safe support/legal form with an advanced JSON editor.
- Added Google Play and Apple App Store listing copy, privacy declarations and asset checklist.
- Added EAS development, preview and production build profiles.
- Added the Expo splash-screen plugin and fixed remaining mobile TypeScript errors.
- Removed fake support defaults so unpublished contact information is never shown to users.
## 1.8.0 - 2026-07-11

- Added an atomic, server-controlled 10-contact free trial that cannot be extended by clearing mobile storage.
- Kept scanning and preview free while requiring server-confirmed payment for Replace and Cleanup.
- Added verified server entitlement checks immediately before premium operations.
- Added resumable Add and Replace jobs with local checkpoints every 25 processed records.
- Added progress reporting for large writes and duplicate-operation protection.
- Preserved chunked, verified local backups and on-device contact privacy.
- Added database migration `010_secure_trial.sql`.
## 1.8.1 - 2026-07-11

- Fixed Windows Expo startup arguments so the launcher no longer forwards a literal `--`.
- Added automatic `expo-splash-screen` dependency detection and repair to `START_ALL.bat` and `START_MOBILE.bat`.
- Removed the dependency-validation bypass from the combined launcher so missing packages fail clearly.
## 1.8.2 - 2026-07-12

- Fixed the runtime `hasApprovedMigrationRules is not a function` error by rebuilding `@gnm/shared` before every combined or mobile-only Windows launch.
- Skipped unsupported remote push initialization in Expo Go while preserving notifications in development and production builds.
- Verified the shared compiled output exports `hasApprovedMigrationRules`.
## 1.8.3 - 2026-07-12

- Fixed PostgreSQL `42P08 could not determine data type of parameter $8` during payment intent creation by passing an explicitly typed JavaScript expiry timestamp as `$9`.
- Made React Native resolve `@gnm/shared` from its TypeScript source, preventing stale compiled rule-engine exports from breaking scans.
- Added clear scan errors when the device returns no contacts or no readable phone numbers.
## 1.8.4 - 2026-07-12

- Rebuilt Admin Migration Rules with working create, edit, activate, disable, test, refresh and publish actions.
- Added conditional fields and numeric input protection for prefix, range, exact and exception rules.
- Made operator-controlled new prefixes read-only within rules to prevent mismatched data.
- Added draft/published rule metrics and a protected rule-status API.
- Added visible success/error states for every operation and clearer API validation messages.
- Preserved the v1.8.3 PostgreSQL payment and mobile scan fixes.
## 1.8.5 - 2026-07-12

- Replaced the generic rules publication failure with exact rule-by-rule blocker messages.
- Added a Publication Blockers panel in Admin.
- Added one-click disabling of active Sample, Demo and Fallback rules.
- Added detailed detection for missing operators, disabled operators, prefix mismatches and equal-priority conflicts.
- Kept non-production safety enforcement while making it clear how to resolve every failure.
# 2.5.0 - 2026-07-18

- Fixed resumable migration selection validation so a different or expanded selection cannot attach to an unfinished job.
- Persisted successful item keys in migration checkpoints so Dashboard and Preview update correctly after pause, restart, and resume.
- Added a generated 100,000-contact rule-engine regression/performance test.
- Re-ran TypeScript, automated tests, API build, Admin build, Expo configuration validation, and Expo Doctor for the release.
# v2.7.0 — OceanBrown Product Upgrade (2026-07-30)

- Redesigned mobile and administration interfaces around a deep-navy and electric-blue OceanBrown product system.
- Added refined press feedback, keyboard focus states, reduced-motion support, and clearer semantic status colours.
- Reworked narrow-screen admin navigation into a sticky, horizontally scrollable control surface.
- Fixed notification inbox spacing across phone and tablet widths.
- Added accessibility roles, labels, busy states, and navigation landmarks to key controls.
- Added a dedicated authentication rate limit.
- Disabled manual payment confirmation whenever payment test mode is off.
- Synchronized application and support version labels at 2.7.0.
- Added the complete v2.7.0 audit and production deployment gates.

# v2.7.1 — Calm and Familiar Interaction Update (2026-07-31)

- Removed button, icon, card, navigation, and dashboard hover scaling or shifting.
- Replaced decorative movement with immediate opacity and colour feedback.
- Removed dialog entrance animation and shortened the artificial splash delay.
- Simplified onboarding language for people with different literacy and technical levels.
- Renamed bottom navigation items to the familiar labels “Cleanup” and “Settings”.
- Preserved reduced-motion support, OceanBrown branding, security protections, and all migration functionality.
>>>>>>> caf642300d18bdafaf97e0019a2a51dfed96b56c
