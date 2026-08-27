# GNM 2.8.17 — audit follow-through and admin RBAC navigation

## Included fixes

- Renumbered two pairs of duplicate-numbered database migrations (`015`/`015`, `017`/`017`) to a clean, unique `001`–`022` sequence. All renumbered files are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), so this is safe to apply to a database that has already run the old filenames.
- Added a "Reset Local App Data" control to mobile Settings, wired to the local-storage clearing function that already existed but had no UI entry point. Clears saved scans, history, unlock state, and local backups; never touches device contacts.
- Admin sidebar navigation now filters by the signed-in role, mirroring the API's own RBAC area map. Finance/Operations/Support accounts no longer see links to sections they cannot open (Audit Logs, Team Access, etc.).
- Added a host-level Nginx reverse-proxy example (`deploy/nginx-host-reverse-proxy.example.conf`) with HTTPS redirect, Certbot ACME-challenge location, TLS, security headers, proxy headers, request-size limits, and timeouts for both the API and Admin domains — the previously undocumented public entry point in front of the production Docker Compose stack.
- Bumped `expo` and `expo-constants` to the patch versions `expo-doctor` reported for SDK 54 compatibility.
- Corrected a stray "send it to ChatGPT" support message in `RUN_THIS_FIRST.bat` to reference OceanBrown support.

## New automated tests

33 new tests added across the workspace (32 → 65 total):

- Shared migration engine: range rules, exception-over-range priority, out-of-range rejection, invalid/foreign numbers, and a rule producing an invalid-length output.
- Mobile: free-trial allowance enforcement and exhaustion, replace-mode premium gating, blocked-device handling, "never charge the allowance for a failed write," interrupted-usage reconciliation, and the full persistent operation-job lifecycle (start/update/finish/fail, throttled writes, refusing to mutate a completed job), plus admin/cleanup schedule availability windows.
- Admin: the new role-based navigation filter.

## Verification performed this release

```
pnpm install --frozen-lockfile   ✅
pnpm typecheck                   ✅ (shared, api, admin, mobile)
pnpm lint                        ✅
pnpm test                        ✅ 65/65 passed
pnpm build                       ✅ (shared, api, admin production builds)
expo export --no-bytecode        ✅ android, ios, web
expo-doctor                      ✅ 18/18
```

See `FULL_AUDIT_2026-08-25.md` for the full findings list, security review, and known limitations (including a documented Windows-only local Hermes-bytecode path-length limitation that does not affect real `eas build` production builds).

## Local test

1. Run `RUN_THIS_FIRST.bat` once.
2. Run `START_ALL.bat`, or `START_MOBILE.bat` for mobile only.
3. Keep phone and PC on the same Wi-Fi/hotspot, scan the LAN QR code in Expo Go.
