# GNM v1.0.0 — Final Audit

**Date:** 2026-08-27
**Scope:** Full production-readiness pass — identifiers, TypeScript gate, campaign/payment policy compliance, mobile header system, security, database migrations, VPS deployment, EAS build profiles, store preparation.

## How to read this document

This audit distinguishes three things, and never blurs them:

- **Verified in this environment** — code was read, edited, and the claim was proven by running `pnpm typecheck`, `pnpm test`, a production build, or a live local render. These are facts, not estimates.
- **Verified by static code review only** — the logic was read carefully and reasoned through, but not exercised on a physical device, a real Postgres instance, a live VPS, or a real EAS/store account. This environment has no Android/iOS device or simulator, no Docker daemon (confirmed unavailable earlier in this project's history), no reachable production Postgres, and no EAS/Apple/Google credentials.
- **Not verified / requires the release owner** — anything that can only be confirmed by actually running an EAS cloud build, submitting to App Store Connect / Play Console, or deploying to the real Contabo VPS. This document gives the exact commands; it does not claim they were run here.

Nothing below claims Play/App Store **production** approval. Reaching Internal Testing / TestFlight is the ceiling of what this audit certifies.

---

## 1. Release identity

| Item | Value | Status |
|---|---|---|
| App name | `GNM` | ✅ Verified in `apps/mobile/app.json` |
| Public version | `1.0.0` | ✅ Unchanged, verified |
| Android package | `gm.oceanbrown.gnm` | ✅ Fixed this pass (was `com.oceanbrown.gambianumbermigrator`) |
| iOS bundle identifier | `gm.oceanbrown.gnm` | ✅ Fixed this pass |
| Android versionCode | `41` | ✅ Incremented from `40` — see note below |
| iOS buildNumber | `40` | ✅ Incremented from `39` |
| EAS project ID | `2f1a4344-3c29-466d-a773-56355f9d4994` | ✅ Already present in `app.json` and `eas.json` — the existing EAS project is reused, nothing new was created |
| Production API | `https://api.oceanbrown.gm/api` | ✅ Verified in `eas.json`, `.env.example` |
| Website | `https://gnm.oceanbrown.gm` | ✅ Verified |
| Privacy | `https://gnm.oceanbrown.gm/privacy` | ✅ Verified |
| Terms | `https://gnm.oceanbrown.gm/terms` | ✅ Verified |
| Support | `https://gnm.oceanbrown.gm/support` | ✅ Verified |

**On versionCode/buildNumber:** changing the Android package name and iOS bundle identifier makes this a *new app identity* on both Google Play Console and App Store Connect — there is no existing store history under `gm.oceanbrown.gnm` for either number to conflict with. I could not query the actual EAS build history or store consoles from this environment, so rather than assume it's safe to reset to `1`, I incremented both forward from their previous values (`40→41`, `39→40`) as the maximum-safety choice. **Before your first real submission, confirm in the EAS dashboard (`eas build:list`) and in App Store Connect / Play Console that these exact numbers are not already in use under this identity; bump further if they are.**

**Firebase (`google-services.json`):** the shipped file was registered to the *old* package name. Expo's Android build validates that the file's `package_name` matches `android.package`, so keeping it as-is would make `eas build --profile production` fail outright once the package changed — worse than not having it. It has been **removed** from this release. The app degrades safely without it: local operation-completion notifications (`notifyLocalCompletion`, used for backup/migration/cleanup/restore completion) don't need Firebase at all; only remote push-token registration does, and that path already fails gracefully (caught, reports "unavailable", never crashes — verified by reading `notificationService.ts:39-56`). **Before the Android production build**, add a new Android app to your Firebase project with package `gm.oceanbrown.gnm`, download the new `google-services.json`, and place it at `apps/mobile/google-services.json` — `app.config.js` picks it up automatically if present.

**Identifier rename — verified complete.** `grep -r "com.oceanbrown.gambianumbermigrator"` across the full source tree (excluding `node_modules`/`dist`) returns zero matches after this pass.

---

## 2. TypeScript gate — `pnpm typecheck`

**Before this pass:** `apps/mobile/src/services/contactsService.test.ts(92,14)` and `(103,14)` failed with `Type '{ id: string; name: string; phoneNumbers: { number: string; }[]; }' is not assignable to type 'never'`.

**Root cause:** the test file's mocked `Contacts.getContactsAsync` was declared as `vi.fn(async () => ({ data: [] }))` with no type annotation. TypeScript infers an empty array literal with no contextual type as `never[]`, so the mock's resolved-value type locked to `{ data: never[] }`. The two failing lines were the first real calls to `mockResolvedValueOnce` with actual contact data against that mock.

**Fix:** added an explicit `MockDeviceContact`/`MockPhoneNumber` type and annotated the mock's return type as `Promise<{ data: MockDeviceContact[] }>`. No `@ts-ignore`, no `any`, no relaxed `strict` settings, no excluded file, no removed test — exactly as required.

**Verified:** `pnpm typecheck` now exits 0 across all four packages (`@gnm/shared`, `@gnm/api`, `@gnm/admin`, `@gnm/mobile`, `@gnm/web`). Ran twice in this session, both clean.

---

## 3. Admin-controlled access campaign

All of the following were verified present and working in `apps/api/src/routes/appConfig.ts`, `apps/api/src/routes/devices.ts` and `apps/admin/src/pages/AppConfig.tsx` — this was **not** a rebuild, it was an audit that found the core design already correct, plus two real gaps that were fixed.

**Already correct (verified, unchanged):**
- Every field the Admin must control — free access mode/limit, free trial limit, subscription price, currency, Wave/APS availability, cleanup availability + start/end, maintenance mode, minimum app version, announcement — exists in `app_config` with Zod validation (`appConfig.ts:9-43`).
- `free_access_mode` supports exactly `off` / `all` / `first_n`. `free_access_user_limit` is a free-form admin-set integer validated to 1–1,000,000 (`appConfig.ts:19-22`) — **not hardcoded to 15 anywhere**; traced end-to-end from the Admin form through Zod validation to the live slot-check query in `devices.ts:76,80`.
- **Concurrency safety:** slot assignment takes a Postgres advisory transaction lock (`pg_advisory_xact_lock`) before counting and granting (`devices.ts:54,79-81`), so concurrent registrations cannot over-grant past the configured limit. This is not a bare read-then-write race.
- **Idempotency:** `devices.id` is the primary key with `ON CONFLICT (id) DO UPDATE`; a device already `access_source='campaign'` is skipped by the grant check, and `promotional_access_granted_at` uses `COALESCE(...)` so it's never overwritten (`devices.ts:78,81`). Re-registering the same device cannot consume a second slot.
- **Admin visibility:** current mode/limit, granted count, remaining slots, and payment-provider state are all present in `GET /admin/free-access-stats` and rendered in the Admin App Config page.
- **Review-mode compliance:** when `free_access_mode = all`, every device registering gets `access_source='campaign'` immediately with no payment, no OTP, no reviewer code — the same code path any real device uses (`devices.ts:80`). Backup, Preview, Migration, Restore, Cleanup, History, Notifications and Settings all gate on `getAccessStatus()`, which reports `active` for a campaign grant identically to a paid one — there is no separate "reviewer" code path that could drift out of sync with what real users get.

**Fixed this pass — genuine gaps found:**
1. **Auto-grants were not audit-logged.** Admin-initiated config changes and device actions (block/unblock/etc.) were already audited; the *automatic* campaign grant that happens inside `/devices/register` was not. Added an `audit(req, 'campaign_access_granted', 'device', ...)` call (`devices.ts`, after the registration transaction) recording the mode, the post-grant campaign count, and the limit at the time of grant. `req.admin` is naturally absent here (this isn't an admin action), so the audit row records `admin_id = NULL` — consistent with how `auditService.ts` was already designed to handle system-initiated events.
2. **"When changed / by whom" wasn't surfaced in the Admin portal for campaign config**, even though `app_config.updated_at` already existed in the schema and every admin change was already in `audit_logs`. `GET /admin/free-access-stats` now joins the most recent `app_config_updated` audit row to `admins` and returns `configLastChangedAt`/`configLastChangedBy`; the Admin App Config page now shows "Last changed: `<timestamp>` by `<admin name>`" under the campaign stats.

**Disclosed, not fixed — reinstall-abuse resistance:** device identity is a client-generated random UUID stored only in AsyncStorage (`deviceService.ts:16-32`, comment: *"App-scoped random identity avoids collecting a platform hardware identifier"*), with no hardware attestation. The code already carries an honest `// TODO: Stronger registration abuse protection requires Apple App Attest or Google Play Integrity device attestation.` (`app.ts:73`). The only real mitigations today are a 10-req/min per-IP rate limit on `/devices/register` and the fact that once campaign slots are exhausted, reinstalling grants nothing. **This is a known, disclosed limitation, not a claim of full abuse-resistance.** Implementing App Attest / Play Integrity is a real native-module project of its own and was out of scope for this pass — it requires a native build to test and cannot be verified in this environment.

---

## 4. Wave/APS and store-policy protection

**Verified already correct, no change needed.** `apps/mobile/app/payment.tsx:11` — `if (EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'store') return <PaymentCheckout />; return <StoreFreeLaunchAccess />;`. This is unconditional on the distribution channel, not on any Admin toggle:

- **`store` channel builds** (`eas.json` production profile) never mount the Wave/APS checkout UI at all — regardless of what the Admin has enabled. They render a payment-free "Free Launch Access" screen that only depends on server-confirmed campaign access. This is the correct, non-bypassable behavior: an Admin cannot re-enable Wave/APS checkout in a store build by flipping a toggle, because the store build's code path physically doesn't reach that screen.
- **`direct`/preview/dev channel builds** show `PaymentCheckout`, which only lists a provider if the Admin has it enabled server-side (`payment-checkout.tsx:98-100`) and the live price loads successfully; if no provider is enabled it shows "Payments coming soon" and creates no payment intent (`payment-checkout.tsx:181-196`).
- This app does not implement Google Play Billing or StoreKit/IAP. Per the spec's own instruction ("do not falsely describe an incomplete simulation as a live production integration"), the honest state is: **no in-store digital payment path exists in this build at all** — store builds rely entirely on the free-access campaign. If OceanBrown later wants paid access inside the Play/App Store editions, that requires implementing real Play Billing / StoreKit, which is unbuilt and unverifiable here.

---

## 5. Mobile header system

The spec described this as needing a ground-up redesign across every screen. On inspection, that assumption was **not accurate** — a centralized `TopNav`/`BackHeader` component already exists in `apps/mobile/src/components/UI.tsx` and is already used consistently across 14 of the app's 16 screens (verified via `grep -l "BackHeader|TopNav" apps/mobile/app/*.tsx`), already wrapped in `SafeAreaView` with all four edges (`Screen`/`ListScreen`), already respects safe areas/notch/Dynamic Island via `react-native-safe-area-context`, already supports back navigation, subtitle, and an arbitrary `right` action slot.

**One real inconsistency was found and fixed:** `dashboard.tsx` implemented its own bespoke header block (custom `View` with hand-duplicated background/border/zIndex/typography values) instead of using the shared component — exactly the kind of duplication the spec is worried about. It has been refactored onto `TopNav`, passing its existing notification-bell and refresh buttons (already correctly sized at 44×44 with proper accessibility labels) through the shared `right` prop. See §12 for the before/after.

**Genuine gaps found and fixed in the shared component itself** (these improve every screen that uses it, not just one):
- `TopNav`'s "eyebrow" line above the title was hardcoded to `"Private • On-device"` with no way to override it — blocking exactly the kind of reuse `dashboard.tsx` needed. Added an optional `eyebrow` prop (defaults to the previous text so no existing screen changes visually).
- The spec explicitly requires header components to **"Support loading, disabled and notification states."** Neither existed. Added `loading` (spinner in place of the back icon, or beside the title when there's no back icon) and `disabled` (dims the header, disables the back button and blocks right-side action touches) props to `TopNav`/`BackHeader`.
- `IconButton`'s accessibility label defaulted to the raw icon name (e.g. a screen reader would announce "left, button" for the back button instead of "Go back, button"). Added a name-to-label map and an `accessibilityLabel` override prop; `TopNav`'s back button now explicitly passes `"Go back"`.
- The header title was hard-capped at `numberOfLines={1}`, which the spec explicitly flags ("avoid title truncation where possible," "handle long titles gracefully"). Changed to 2 lines with `flexShrink`, so a genuinely long title wraps instead of being cut mid-word. No existing screen's appearance changes, since all current titles are short.
- Confirmed the existing back-button touch target (`size=42` + `hitSlop={6}`) already satisfies the 44×44/48×48 minimum — the interactive hit area is 54×54, comfortably over both platform minimums. No change needed there.

**Verified:** `pnpm typecheck` clean after every header edit; the change to `dashboard.tsx` is a strict layout-preserving refactor (every style value for the two right-side buttons was kept byte-for-byte identical, only the outer shell was consolidated onto the shared component) — reasoned through by direct code comparison, not confirmed by a live device render (see §13 for what device-level verification this still needs).

---

## 6. Contact migration & duplicate cleanup safety

This area was extensively audited and fixed in prior work on this same source tree (see `CHANGELOG.md` entries for 2026-08-26, including the backup checksum/targeted-restore work, the concurrency lock across migration/cleanup/backup/restore, and — earlier in this session — the Cleanup screen duplicate-key bug and its root cause, a stale cached scan missing the `phoneIndex` field, fixed via `SCAN_SCHEMA_VERSION` invalidation). Spot-re-verified this pass:

- Only approved published rules are used (`hasApprovedMigrationRules` gate before every scan — `contactsService.ts:127`).
- A previous scan never blocks a new one; rescanning is always available from the Dashboard.
- Already-migrated numbers are tracked via `status` and not re-migrated (`updateStoredScanAfterMigration`).
- Replace mode does not remove the old number until the write is verified (`replace_update` path reads back and verifies before considering the swap successful).
- Cleanup requires the new number to already exist before removing the old one (`removeOldDuplicates`, `hasNew`/`hasOld` check, `contactsService.ts:596-602`) — the only valid number can never be the one removed, and unrelated duplicates are untouched since matching is scoped to the exact old/new pair.
- A local backup is created before any destructive cleanup or migration write (`createOldMigrationBackup`), verified non-empty before being trusted (`saveBackupRecord` throws on an empty backup).
- Failed contacts don't stop the batch — `groupByContact` processes per-contact, catching and recording failures individually, continuing the loop.
- Admin cleanup scheduling (`cleanup_available_from`/`_until`/`cleanup_enabled`) is enforced server-side via live config, not just hidden client-side.

No new correctness issues were found in this area this pass.

---

## 7. Privacy & data safety

- Contact names/numbers/backups verified to never leave the device (`scanContacts`, `createFullContactsBackup`, `createOldMigrationBackup` all operate purely on local `expo-contacts` data and local `AsyncStorage`; no contact field is ever included in any API request body — confirmed by reading every `api.ts` call site).
- Server retains only device metadata, access status, payment records and push tokens — never contact data. Documented precisely in the new `/data-deletion` page (§8).
- All production traffic is HTTPS (`api.oceanbrown.gm`, enforced by the host Nginx TLS termination in `deploy/nginx-host-reverse-proxy.example.conf`).
- No sensitive data in logs: the API's error handler returns a generic message and only `console.error`s server-side in both dev and prod (`errorHandler.ts:9-30`); support codes are a one-way SHA-256 hash of the device id, never the raw id or IP.

---

## 8. Data-deletion mechanism — new this pass

**Gap found:** no user-facing data-deletion mechanism or public deletion-request page existed, despite the API retaining device records and payment records server-side.

**Fixed:** added `apps/web/src/pages/DataDeletion.tsx`, routed at `/data-deletion` (`gnm.oceanbrown.gm/data-deletion`), linked from the site footer and from Privacy Policy §9. It plainly states what never leaves the device, exactly what the server does retain, how to request deletion (email to the configured support address, with a pre-filled subject/body), the 30-day active-system / 90-day backup-rotation deletion window, and the one legally-mandated exception (payment records where required for accounting/fraud purposes). Verified: `pnpm --filter @gnm/web typecheck` and `build` both clean; the page was rendered live in a local preview and confirmed to display the correct content, correct support email interpolation, and correct footer/header.

---

## 9. API & Admin security

Full findings from a dedicated read-only audit of `apps/api/src`:

| Area | Finding |
|---|---|
| JWT auth | HS256, 8h expiry, issuer/audience pinned (`middleware/auth.ts:14-31`). Production **refuses to start** if `JWT_SECRET` is missing, under 32 chars, or a known placeholder (`config/env.ts:21-28`). |
| RBAC | `requireAdmin` + `requireAdminAreaAccess` (role→URL-prefix map) applied globally to `/api/admin/*`; every admin-mutating route re-checked individually — no ungated route found. Owner-only team operations use `requireRoles('owner')`. |
| Password hashing | bcrypt, cost 12. |
| Rate limiting | Global 200/60s; login 10/15min; device registration 10/60s; device-status 60/60s; admin uploads 20/60s; public inquiries 6/60s. |
| CORS | Allowlist from `CORS_ORIGIN`, not wide-open; production additionally rejects localhost origins. |
| Security headers | `helmet()` applied; `x-powered-by` disabled. |
| Uploads | 3MB limit, single file, explicit MIME allowlist, server-generated filenames (`crypto.randomUUID()`) — no path traversal possible. |
| SQL injection | 100% parameterized queries (`$1,$2,...`); no string-concatenated SQL found anywhere in `apps/api/src`. |
| Payment idempotency | `(device_id, idempotency_key)` uniqueness checked before creating a new payment intent — retries return the existing record. |
| Webhook signatures | HMAC-SHA256 over `timestamp.rawBody`, `crypto.timingSafeEqual`, tolerance window, event-id dedup via a DB unique constraint. |
| Audit logging | Broad coverage across admin-mutating routes; campaign auto-grants added this pass (§3). |
| Error sanitization | Generic 500 body, real error only server-logged, in both dev and prod. |
| Admin session/logout | Logout audits the event but is **stateless** — a JWT issued before logout remains valid until its 8h expiry if replayed. Disabled admins **are** rejected on their next request (live `status` re-check on every `requireAdmin` call). |
| Brute-force protection | Dedicated 10/15min limiter on `/api/auth/login`. |
| Hardcoded secrets | None found; all sourced from `process.env` with only non-sensitive localhost defaults for local dev. |

**One disclosed trade-off, not fixed this pass:** logout doesn't proactively revoke the JWT (no server-side denylist). The blast radius is bounded by the 8h expiry. Implementing a revocation list is a reasonable follow-up but wasn't attempted here to avoid rushing a change to session-handling infrastructure this late without a way to test it against a real running server in this environment.

---

## 10. Database migrations (001–024)

Verified via a dedicated read-only audit:

- All 24 migrations present, uniquely numbered, contiguous, no gaps.
- The runner (`apps/api/src/scripts/migrate.ts`) tracks applied migrations in `schema_migrations` and skips already-applied files; every migration runs inside its own transaction.
- Idempotent patterns used throughout (`IF NOT EXISTS`, `ON CONFLICT ... DO NOTHING/UPDATE`, `DROP CONSTRAINT IF EXISTS` + re-`ADD`, `DO $$ ... EXCEPTION WHEN duplicate_object` guards).
- **Migration 020 (`payments_device_fk`) — confirmed correctly fixed**: wraps `ADD CONSTRAINT` in a `pg_constraint` existence check, preceded by a backfill that creates placeholder `devices` rows for any orphaned `payments.device_id` so the constraint can't fail against existing data. `apps/api/src/scripts/verify-migrations.ts` has dedicated regression scenarios for exactly this bug (clean-apply, rerun-is-noop, constraint-present-but-unrecorded, upgrade-with-orphan-rows), run against disposable scratch databases — never the real `DATABASE_URL`.
- No destructive DDL (`DROP TABLE`, `TRUNCATE`, `DROP COLUMN`) anywhere in `database/migrations/`. The one `DELETE` (migration 008, deduplicating seed rules) is scoped to true duplicates and immediately followed by a unique index preventing recurrence.
- Foreign keys for payments→devices (020), device push tokens→devices (`ON DELETE CASCADE`), and push tickets→notifications/tokens (`ON DELETE CASCADE`) all present and correctly constrained.
- `apps/api/src/scripts/reset.ts` (`DROP SCHEMA public CASCADE`) exists but is **not** part of the migration runner, the Docker `CMD`, or the deploy sequence — it's a manually-invoked dev script gated behind a `Type RESET to continue` prompt (`RESET_DATABASE.bat`). **Never run this against the production database.**

**Not verified in this environment:** actually running `pnpm --filter @gnm/api db:verify-migrations` against a live Postgres — no reachable Postgres instance here (same limitation noted in the prior audit on this source tree). The verification script itself was read and confirmed to be a genuine scratch-database dry run, not a rubber stamp.

---

## 11. VPS / Docker readiness

Verified via a dedicated read-only audit of `docker-compose.production.yml`, the three Dockerfiles, and the Nginx configs:

- **`postgres`**: `postgres:16-alpine`, named persistent volume `gnm_pg_data`, **no `ports:` mapping — not exposed to the host or publicly**, `pg_isready` healthcheck.
- **`api`**: multi-stage `node:22-alpine` build, bound to `127.0.0.1:8089`, persistent `gnm_uploads` volume, `depends_on postgres: condition: service_healthy`, `CMD` runs migrations then starts the server.
- **`admin`**: multi-stage → `nginx:1.27-alpine`, bound to `127.0.0.1:5173`.
- **`web`**: same pattern, bound to `127.0.0.1:5174`.
- Host-level Nginx (`deploy/nginx-host-reverse-proxy.example.conf`) is the sole public entry point for all three domains — HTTP→HTTPS redirect, Certbot ACME location, TLS, HSTS. No Postgres server block anywhere in it.
- `.env` is never committed — only `.env.example`. Required vars (`POSTGRES_PASSWORD`, `VITE_API_BASE_URL`) use Compose's `:?` hard-fail syntax.
- No destructive reset is wired into the compose file, Dockerfile `CMD`s, or the deploy sequence in `DEPLOYMENT.md`.

**Fixed this pass — genuine gap:** the `api`, `admin` and `web` services had no `healthcheck:` block (only `postgres` did), and `admin`/`web` used a plain `depends_on: [api]` instead of waiting for API health. Added:
- `api`: a Node-native HTTP check against `/api/health` (no extra binary dependency needed in the alpine image).
- `admin`/`web`: `wget --spider` against their own root (available via Alpine's busybox in the `nginx:1.27-alpine` base).
- `admin`/`web` now `depends_on: api: condition: service_healthy` instead of an unconditional dependency.

**Not verified in this environment:** no Docker daemon is available here (confirmed unavailable in this project's history — Docker Desktop's service would not start without elevated privileges), so `docker compose -f docker-compose.production.yml config`/`build`/`up` were not actually executed. The YAML was hand-verified for structural correctness against the existing valid `postgres` healthcheck block as a template.

---

## 12. Header system — before / after

No physical device or simulator is available in this environment, so this is a **structural before/after**, not a device screenshot pair. The only screen whose header actually changed is `dashboard.tsx`; every other screen already used the shared component and is visually unchanged.

**Before** (`apps/mobile/app/dashboard.tsx`, prior to this pass):
```tsx
<View style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, zIndex: 20, elevation: 8 }}>
  <View style={{ /* ...hand-duplicated padding/maxWidth wrapper... */ }}>
    <View style={[styles.rowBetween, { gap: 12 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.primary, fontSize: 12, letterSpacing: 1.5, fontWeight: '900' }}>GAMBIA NUMBER MIGRATOR</Text>
        <Text numberOfLines={1} style={{ /* ...hand-duplicated title typography... */ }}>Dashboard</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>{/* bell + refresh buttons */}</View>
    </View>
  </View>
</View>
```
Every value here (background, border, z-index, padding, the eyebrow/title font sizes and letter-spacing) was a second, independent copy of what `TopNav` already implements.

**After:**
```tsx
<TopNav
  title="Dashboard"
  eyebrow="GAMBIA NUMBER MIGRATOR"
  right={<>{/* the same bell + refresh buttons, unchanged pixel-for-pixel */}</>}
/>
```
Visually **identical** on screen (every style value for the visible content was carried over unchanged) — the fix is structural: one header implementation instead of two, and the shared component gained the `eyebrow` override it needed to absorb this case, which now benefits any future screen with the same "no back button, custom branding line" shape.

---

## 13. Screen-by-screen mobile UI QA

**This is a static code-review QA pass, not live-device testing.** No physical Android/iOS device, emulator, or simulator is available in this environment. Each row reflects what was confirmed by reading the screen's source against the requirement checklist (safe area, header, empty/loading/error states, touch targets).

| Screen | Header | Safe area | Empty state | Loading state | Error handling | Notes |
|---|---|---|---|---|---|---|
| Dashboard | `TopNav` (consolidated this pass) | `SafeAreaView`, 4 edges | N/A (always has content) | Scan progress bar + running-operation card | `showDialog` on scan failure | ✅ |
| Onboarding | `TopNav`, Skip escape hatch | `Screen` wrapper | N/A | N/A | Permission failure shown, doesn't block flow | ✅ explains privacy before requesting contacts access |
| Notification permission | `BackHeader` | `Screen` wrapper | N/A | N/A | Denial handled, links to Settings for manual re-enable | ✅ |
| Preview | `BackHeader` | `Screen`/custom FlatList | `EmptyState` (scan required / no matches) | Inline during migration batch | `showDialog` per-failure, batch continues | ✅ |
| Scan complete | `BackHeader` | `Screen` | N/A | N/A | N/A (summary screen) | ✅ |
| Cleanup | `BackHeader` | `ListScreen` | `EmptyState` | Progress bar during batch | `showDialog` on failure | ✅ index-safe list keys (this session's earlier fix) |
| Backup | `BackHeader` | `ListScreen` | `EmptyState`, loading spinner while checking access | `ActivityIndicator` | `showDialog` | ✅ |
| Backup complete | `BackHeader` | `Screen` | N/A | N/A | N/A | ✅ |
| Restore complete | `BackHeader` | `Screen` | N/A | N/A | Shows per-item failure reasons | ✅ |
| History | `BackHeader` | `ListScreen` | `EmptyState` | N/A (local read) | N/A | ✅ |
| Notifications | `BackHeader` | `Screen` | Handled | Setup-in-progress state | Denial/unavailable reasons surfaced | ✅ |
| Settings | `BackHeader` | `Screen` | N/A | N/A | N/A | ✅ has "open device settings" deep link |
| Payment (store channel) | `BackHeader` | `Screen` | N/A | Access-check spinner | Connectivity notice | ✅ no Wave/APS reachable in store builds |
| Payment checkout (direct channel) | `BackHeader` | `KeyboardAvoidingView` + `Screen` | "Payments coming soon" when no provider enabled | Price-loading state | `showDialog` on failed intent/OTP | ✅ |
| Complete (migration) | `BackHeader` | `Screen` | N/A | N/A | Shows failed/skipped/updated counts | ✅ |

**Not verified here and genuinely requiring a device:** actual rendering on small Android screens, large Android screens, iPhone SE, Dynamic Island devices, and tablets; font-scaling/accessibility text sizing; dark-mode contrast on a real display; keyboard-avoidance behavior on a real keyboard; touch-target feel. The `Screen`/`ListScreen`/`TopNav` components were built with `useSafeAreaInsets()` and `useResponsive()` throughout, which is the correct approach for these cases, but "correct approach in code" is not the same claim as "confirmed on device," and this document does not conflate the two.

---

## 14. Release-gate table

| Gate | Status |
|---|---|
| Public version `1.0.0` | ✅ Pass |
| Android package `gm.oceanbrown.gnm` | ✅ Pass |
| iOS bundle identifier `gm.oceanbrown.gnm` | ✅ Pass |
| EAS project reused, not recreated | ✅ Pass |
| `pnpm typecheck` — zero errors | ✅ Pass (verified, ran clean) |
| `pnpm test` — all passing | ✅ Pass (112 tests, verified) |
| Shared package build | ✅ Pass (part of `pnpm test`/`typecheck` pipeline) |
| API production build (`tsc`) | ✅ Pass |
| Admin production build | ✅ Pass |
| Website production build (`vite build`) | ✅ Pass, verified live in local preview |
| Campaign modes (`all`/`first_n`/`off`) implemented, limit not hardcoded | ✅ Pass |
| Campaign assignment atomic/concurrency-safe/idempotent | ✅ Pass |
| Campaign assignment audited | ✅ Pass (fixed this pass) |
| Admin sees last-changed/by-whom for campaign config | ✅ Pass (fixed this pass) |
| Reinstall-abuse resistance | ⚠️ Disclosed limitation — rate-limit only, no device attestation |
| Store-policy payment gating cannot be bypassed by Admin toggle | ✅ Pass (verified pre-existing, unconditional on distribution channel) |
| Real Play Billing / StoreKit IAP implemented | ❌ Not implemented — no in-store paid path exists |
| Mobile header — single reusable component, duplication removed | ✅ Pass |
| Contacts remain local (never uploaded) | ✅ Pass |
| Migration/cleanup safety invariants | ✅ Pass (verified, pre-existing + this session's cleanup-key fix) |
| Database migrations 001–024 verified (ordering, idempotency, no data loss) | ✅ Pass (static verification; not run against a live DB here) |
| Data-deletion mechanism | ✅ Pass (added this pass) |
| API security posture | ✅ Pass, one disclosed trade-off (stateless JWT logout) |
| Secrets excluded from shipped source | ✅ Pass — only `.env.example` files ship; stale `google-services.json` removed |
| VPS Docker Compose / Dockerfiles / Nginx | ✅ Pass (static verification; healthchecks added; not run against a live Docker daemon) |
| PostgreSQL not exposed publicly | ✅ Pass |
| EAS preview APK build | ⚠️ Not Verified — requires real EAS credentials, not run here |
| Google Play AAB build | ⚠️ Not Verified — requires real EAS credentials, not run here |
| iOS TestFlight build | ⚠️ Not Verified — requires real EAS/Apple credentials, not run here |
| Live device/simulator UI QA | ⚠️ Not Verified — no device/simulator available; static code review only (§13) |
| Actual VPS deployment | ⚠️ Not Verified — no live VPS in this environment |
| Store Console submission (Internal Testing / TestFlight) | ⚠️ Not Verified — requires real store accounts |

**Summary:** everything checkable from source code, local tooling, and a local browser preview was checked and, where genuinely broken, fixed and re-verified. Everything requiring a physical device, a live Docker daemon, a reachable production Postgres, real EAS/Apple/Google credentials, or an actual VPS is honestly marked Not Verified — this document gives the exact commands for each in the companion docs, but does not claim they were executed here.

---

## 15. Files modified in this pass

```
apps/mobile/app.json                              — identifier rename, versionCode/buildNumber bump
apps/mobile/google-services.json                   — removed (stale, wrong package name)
README.md                                          — identifier rename
STORE_RELEASE.md                                   — identifier rename
apps/mobile/src/services/contactsService.test.ts   — TypeScript fix (typed mock contact data)
apps/api/src/routes/devices.ts                     — audit-log campaign auto-grants
apps/api/src/routes/appConfig.ts                   — expose config last-changed-at/by
apps/admin/src/pages/AppConfig.tsx                 — display last-changed info
apps/mobile/src/components/UI.tsx                  — TopNav eyebrow/loading/disabled, IconButton a11y+disabled
apps/mobile/app/dashboard.tsx                       — consolidated bespoke header onto TopNav
apps/web/src/pages/DataDeletion.tsx                — new: public data-deletion page
apps/web/src/App.tsx                               — new route
apps/web/src/components/SiteShell.tsx              — footer link to data-deletion page
apps/web/src/pages/Privacy.tsx                     — link to data-deletion page
docker-compose.production.yml                      — healthchecks for api/admin/web, dependent health conditions
CHANGELOG.md                                       — this pass's entry
GNM-v1.0.0-FINAL-AUDIT.md                          — new (this document)
GNM-v1.0.0-VPS-DEPLOYMENT.md                       — new
GNM-v1.0.0-GOOGLE-PLAY-INTERNAL-TESTING.md         — new
GNM-v1.0.0-APPLE-TESTFLIGHT.md                     — new
```

Everything else in the source tree is unchanged from the prior verified state documented in `FULL_AUDIT_2026-08-26.md` and `CHANGELOG.md`.
