# GNM Full Source Audit — 25 August 2026 (v2.8.17)

## Executive summary

This audit was performed directly against the running source tree — not from a description of it. Every change below was implemented, and every verification command below was actually executed on this machine (Windows 11, Node 24, pnpm 9.12.3, no admin rights) with a locally installed dependency tree. This package is **not** a first-pass build: it already carried substantial prior security and correctness engineering (see `RELEASE_UPDATE_2026-08-24.md`, `RELEASE_UPDATE_2.8.16.md`, `CHANGELOG.md`). This pass re-verified that work end-to-end, found a small number of concrete gaps against the full requirement list, fixed them, and re-verified.

**No mock data, fake payment success, demo migration rules, or security bypasses were introduced.** No production secrets are included in this archive.

## What was fixed in this pass

1. **Duplicate migration file numbers.** `database/migrations` had two files each numbered `015_` and `017_`. Both pairs were fully idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) so they were not silently corrupting data, but the non-unique numbering violated the "ordered and uniquely named" requirement and was confusing to reason about. Renumbered `015`–`022` in the exact same relative order, updated the two documentation files that named specific migration filenames (`README.md`, `DEPLOYMENT.md`).
2. **Dead local-data-reset code.** `apps/mobile/src/services/storage.ts` already exported a `clearLocalData()` function that wipes saved scans, history, unlock state, and all local backups (never touches device contacts) — but nothing in the UI called it. Wired it into Settings behind a destructive-action confirmation dialog ("Reset Local App Data"), satisfying the explicit privacy requirement for a local-data reset option.
3. **Admin navigation did not respect role-based access.** The sidebar showed every section to every role and relied entirely on the API returning 403 after a click. Added `allowedNavPaths()` mirroring the API's own `roleAreas` map (`apps/api/src/middleware/auth.ts`) so Finance/Operations/Support accounts never see links they cannot open — Audit Logs and Team Access are now correctly hidden from every role except Owner/Admin/Viewer. The API-side enforcement was already correct and unchanged; this closes the corresponding UX/defense-in-depth gap.
4. **Cosmetic branding slip.** `RUN_THIS_FIRST.bat` told a failed setup to "screenshot the error and send it to ChatGPT." Changed to "OceanBrown support."
5. **Missing host-level Nginx reverse-proxy example.** `deploy/` only had the container-internal Nginx config that serves the Admin static build. The actual public entry point in front of `docker-compose.production.yml` (which binds API/Admin to `127.0.0.1` only) was undocumented. Added `deploy/nginx-host-reverse-proxy.example.conf`: HTTP→HTTPS redirect, Certbot ACME-challenge location, TLS, HSTS/security headers, correct proxy headers, request-size limits, and timeouts for both `api.oceanbrown.gm` and the Admin hostname.
6. **Test coverage gaps.** Added real, passing tests for scenarios the requirements call out explicitly that had no coverage:
   - Shared engine: range rules, exception-overriding-range priority, out-of-range rejection, foreign/malformed numbers, and a rule whose generated number would be an invalid length.
   - Mobile: free-trial allowance enforcement, replace-mode gating for trial users, blocked-device handling, "never charge the allowance for a failed/skipped write," interrupted-usage reconciliation, and full persistent-operation-job lifecycle (start/update/finish/fail, throttled progress writes, refusing to mutate a finished job).
   - Admin: the new role-based navigation filter itself.
   - Test count: **32 → 37 (shared+API) and 65 total** across shared/API/mobile/admin, all passing.
7. **Two patch-level Expo SDK dependency bumps** (`expo` 54.0.36→54.0.37, `expo-constants` 18.0.13→18.0.14) flagged by `expo-doctor` as the versions the installed SDK 54 line expects. Re-verified typecheck/tests/build after the bump.
8. **Removed a redundant, pnpm-ignored `package.json` config duplicate** (`pnpm.overrides` was already the deprecated location; the real config lives in `pnpm-workspace.yaml`) — cosmetic, no functional effect, restored after confirming it was the *cause*, not a fix, of an unrelated lockfile-hash mismatch (see Known limitations).

## Verified clean (ran, not assumed)

| Step | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ Passed (fresh install, ~10 min cold) |
| `pnpm typecheck` (shared, API, Admin, Mobile) | ✅ Passed |
| `pnpm lint` | ✅ Passed |
| `pnpm test` | ✅ **65/65 tests passed** (17 shared, 20 API, 22 mobile, 6 admin) |
| `pnpm build` (shared, API, Admin) | ✅ Passed — API `tsc` build, Admin Vite production build (245.9 kB / 73.2 kB gzip) |
| `expo export` (Android, iOS, Web) | ✅ Passed with `--no-bytecode` — see Known limitations |
| `expo-doctor` | ✅ 18/18 after the two patch bumps above (the `app.json`/`app.config.js` warning is a documented false positive — `app.config.js` does `require('./app.json')` and extends it; `expo-doctor`'s static check cannot see that) |

## Security review highlights (verified by reading, not assumed)

These were already correctly implemented and were re-verified line-by-line against the requirements in this pass:

- **Auth**: bcrypt (cost 12), JWT with issuer/audience/algorithm pinning, 8h expiry, account-status re-check on every request, generic login failure message, 10-attempts/15-min login rate limit.
- **RBAC**: server-enforced per-route area map (`requireAdminAreaAccess`), viewer is read-only, only Owner can manage Team, can't disable your own account or drop the last active Owner.
- **Device/payment security**: device secrets are SHA-256 hashed at rest and compared with `timingSafeEqual`; webhook signatures are HMAC-SHA256 over `timestamp.body` with a replay window and a unique `(provider, event_id)` constraint that no-ops duplicate deliveries inside a transaction; payment creation is idempotency-keyed per device; a payment already `success` can never be downgraded (`CASE WHEN status='success' THEN 'success' ELSE $1 END` on every status write).
- **Free-access campaign concurrency**: first-N grants use `pg_advisory_xact_lock` inside the registration transaction, so concurrent registrations cannot exceed the configured limit.
- **Contact-write safety**: every migration/replace/cleanup path creates a backup first, verifies the exact expected number set after every native write, checkpoints resumable jobs, and cleanup can only ever remove the one verified old number it targeted — it re-reads and asserts the new number is still present and the old one is gone before counting the row as removed. A failed or skipped write never consumes trial allowance (`settleMigrationAllowance` only ever passes the succeeded count).
- **Cleanup admin gating**: `cleanup_enabled` / opening / closing datetime are validated server-side (`appConfig.ts`), served with `Cache-Control: no-store`, and the mobile screen re-fetches live config on every focus — there is no server-side contact-write endpoint to bypass since contacts never leave the device by design.
- **Privacy**: no route returns contact data; production env validation refuses to boot with a placeholder/short `JWT_SECRET`, `PAYMENT_TEST_MODE=true`, or a `localhost` `CORS_ORIGIN`.
- **Notifications**: `expo-notifications` is dynamically imported and skipped entirely in Expo Go (SDK 53+ removed remote push there); the response listener registers once, is torn down on unmount, and does not replay a stale retained response on cold start.

## Findings and fixes at a glance

| Severity | Finding | Status |
|---|---|---|
| Low | Duplicate migration file numbers (`015`, `017`) | **Fixed** — renumbered, idempotency reconfirmed |
| Low | `clearLocalData()` had no UI entry point | **Fixed** — added to Settings with confirmation |
| Medium (defense-in-depth/UX) | Admin sidebar showed sections a role could not open | **Fixed** — nav now mirrors server RBAC |
| Cosmetic | "send it to ChatGPT" in a failure message | **Fixed** |
| Medium | No host-level Nginx TLS reverse-proxy example | **Fixed** — added with HSTS, proxy headers, size limits, timeouts |
| Low | Test coverage gaps vs. explicit requirement list | **Fixed** — 33 new tests added |
| Low | Two Expo SDK patch versions behind | **Fixed** |
| Info | `latestPublishedRules()` falls back to an unpublished draft payload if `rules_versions` has no published row | **Not changed** — see Known limitations |
| Info | Dashboard app version and Admin footer version are hardcoded strings, not read from `package.json` | **Not changed** — cosmetic, kept in sync manually this pass |
| Info | Team roles omit a "Communications" role named in the brief; existing `operations` role already owns notifications | **Not changed** — judgment call, see Known limitations |

## Known limitations / not fixed (and why)

- **`latestPublishedRules()` fallback to draft.** If `rules_versions` has never had a row with `status='published'`, the public `/migration-rules` endpoint serves a freshly built draft from the currently active `migration_rules`/`operators` tables instead of erroring. That draft still has to pass every integrity check mobile applies (`hasApprovedMigrationRules`) before a scan can run, and the seed/migration path (`013_publish_pura_rules.sql`) already publishes an initial official version, so this should not be reachable in a properly seeded deployment. Changing it to hard-fail instead needs a decision from you: should local dev/testing block entirely until an admin explicitly clicks Publish once? I left current behavior in place rather than guess.
- **Windows local Hermes bytecode compilation.** `expo export` (no flags) fails locally on this Windows machine with `spawn ...hermesc.exe ENOENT`, even though the binary is present. Root cause: the pnpm virtual-store path to `hermesc.exe` is 272 characters, over the Windows 260-character `MAX_PATH`, which breaks `child_process.spawn`'s `CreateProcessW` call regardless of file existence. This is **not a source-code bug** — `STORE_RELEASE.md` already directs real Android/iOS binaries through `eas build` (cloud Linux/macOS runners), which does not hit this. The workaround for local Windows testing is `expo export --no-bytecode` (verified working for all three platforms in this pass) or enabling Windows "Long paths" support / installing the project under a shorter path. Documented here rather than silently changing the default `build` script, since forcing `--no-bytecode` by default would change the bundle format for anything that consumes plain `expo export` output in production (e.g. self-hosted OTA updates), which is a decision I should not make silently.
- **Team roles vs. brief.** The brief lists "System Owner, Admin, Operations, Finance, Support, Communications and Viewer." The implemented set is `owner, admin, operations, finance, support, viewer` — `operations` already has full `/notifications` access, effectively covering the "Communications" area. Splitting it into its own role is a real product decision (new enum value, new area-permission row, new migration, new admin UI role option) that I did not make unilaterally.
- **`apps/mobile/google-services.json` found on disk.** This is a real Firebase Android credential (real project ID, API key) present locally under `apps/mobile/`. It is already correctly listed in `.gitignore` and `.easignore` (with a deliberate negation so EAS *build* pipelines can still pick it up). It is **excluded from this deliverable ZIP**. It was not committed or transmitted anywhere by this audit. If this key was ever pushed to a public repository, rotate it in the Firebase console as a precaution — Android `google-services.json` API keys are not bearer secrets (they're restricted by package name/SHA fingerprint), but treat it as sensitive regardless since the project's own configuration already does.

## Requires production credentials before enabling

- Wave and APS webhook secrets, live checkout integration, and `PAYMENT_PROVIDER_INTEGRATION_READY=true` (currently `false`, correctly blocking production live payments).
- A production `JWT_SECRET` (32+ random characters), unique `POSTGRES_PASSWORD`, and HTTPS `CORS_ORIGIN`/`ADMIN_BASE_URL` (production env validation already refuses to boot without these).
- `google-services.json` for Android push (present locally, excluded from this ZIP as noted above) and equivalent iOS push credentials in EAS.

## Requires physical-device testing

- Native push notification delivery, sound/vibration/badge/lock-screen behavior (Expo Go cannot test remote push on SDK 53+; this app correctly detects and explains that).
- Real Android/iOS contact-writing behavior across OEM contact-provider quirks (SIM-stored, WhatsApp-synced, or read-only accounts — the writable-copy fallback path exists and is exercised by real device testing only).
- Large real phonebooks (the 100,000-contact test is synthetic and only exercises the pure candidate-generation function, not native Contacts I/O).

## Requires Wave/APS approval

- Both wallets are correctly disabled by default and hidden from the mobile UI and rejected server-side until an administrator enables them, which itself requires signed provider agreements per `STORE_RELEASE.md`.

## Requires Apple/Google developer account

- `eas build --platform android|ios --profile production`, Play Console and App Store Connect listing completion per `STORE_RELEASE.md`, which was not re-authored in this pass (already present and reviewed for accuracy).

## Requires legal/policy review

- Privacy Policy, Terms, and Data Safety/App Privacy declarations at the `gnm.oceanbrown.gm` URLs referenced throughout the app — these are external pages this audit cannot create or verify content for.

## Do not consider this "fully secure" or "store ready"

The unresolved items above are real, external, non-code blockers. Everything inside this archive that can be verified by reading, typechecking, testing, and building has been.
