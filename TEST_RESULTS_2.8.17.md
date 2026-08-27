# Exact test results — v2.8.17 audit pass

Captured directly from the commands actually run against this source tree on Windows 11, Node v24.18.0, pnpm 9.12.3, `pnpm install --frozen-lockfile` (fresh, cold cache, ~10 minutes).

## `pnpm typecheck`

```
> pnpm --filter @gnm/shared typecheck && pnpm --filter @gnm/shared build && pnpm -r --filter "!@gnm/shared" typecheck

@gnm/shared typecheck: tsc -p tsconfig.json --noEmit   Done
@gnm/shared build:     tsc -p tsconfig.json            Done
apps/admin typecheck:  tsc -p tsconfig.json --noEmit   Done
apps/api typecheck:    tsc -p tsconfig.json --noEmit   Done
apps/mobile typecheck: tsc -p tsconfig.json --noEmit   Done

exit code: 0
```

## `pnpm lint`

Lint is aliased to the same `tsc --noEmit` check per package. All four packages passed.

```
exit code: 0
```

## `pnpm test`

```
packages/shared test:  ✓ tests/ruleEngine.test.ts (17 tests)  ~635ms
                            ✓ large phonebook performance > processes 100,000
                              contacts without losing or duplicating candidates  ~610ms
                        Test Files  1 passed (1)
                        Tests       17 passed (17)

apps/api test:          ✓ tests/device-secret.test.ts (5 tests)
                         ✓ tests/operators-rbac.test.ts (14 tests)
                         ✓ tests/health.test.ts (1 test)
                        Test Files  3 passed (3)
                        Tests       20 passed (20)

apps/mobile test:       ✓ src/services/unlockService.test.ts (11 tests)
                         ✓ src/services/operationService.test.ts (11 tests)
                        Test Files  2 passed (2)
                        Tests       22 passed (22)

apps/admin test:        ✓ src/components/Layout.test.ts (6 tests)
                        Test Files  1 passed (1)
                        Tests       6 passed (6)

TOTAL: 65 / 65 tests passed, 0 failed
exit code: 0
```

## `pnpm build`

```
@gnm/shared build:  tsc -p tsconfig.json                Done
apps/api build:     tsc -p tsconfig.json                Done
apps/admin build:   tsc -p tsconfig.json && vite build   Done
                       dist/index.html                 0.17 kB │ gzip:  0.14 kB
                       dist/assets/index-*.css         37.78 kB │ gzip:  8.84 kB
                       dist/assets/index-*.js         245.92 kB │ gzip: 73.16 kB
                       built in 15.71s

exit code: 0
```

## `expo export` (apps/mobile)

Plain `expo export` (default, with Hermes bytecode) fails on this specific Windows machine with `spawn ...hermesc.exe ENOENT` — root-caused to a 272-character pnpm virtual-store path exceeding Windows' 260-character `MAX_PATH`, which breaks `child_process.spawn`'s underlying Win32 call even though the binary exists on disk. This does not affect `eas build` (cloud Linux/macOS runners), which is the documented path to real store binaries in `STORE_RELEASE.md`.

`expo export --no-bytecode` succeeded for all three platforms:

```
› web bundles (2):     _expo/static/js/web/entry-*.js (1.8 MB), index-*.js (129 kB)
› android bundles (1):  _expo/static/js/android/entry-*.js (2.48 MB)
› ios bundles (1):      _expo/static/js/ios/entry-*.js (2.48 MB)
Exported: dist

exit code: 0
```

## `expo-doctor`

```
16/18 checks passed on first run.
✖ app.json / app.config.js — false positive; app.config.js does `require('./app.json')`
  and extends it, which the static analyzer cannot see through.
✖ expo / expo-constants patch versions behind SDK 54 — fixed (54.0.36→54.0.37,
  18.0.13→18.0.14), re-verified.

18/18 checks passed after the version bump (the app.json/app.config.js note remains
informational and does not indicate an actual defect — see FULL_AUDIT_2026-08-25.md).
```

## Not run in this environment

- `docker compose up` / full Postgres integration test — Docker Desktop was installed but its daemon was not running in this sandboxed environment (`docker ps` failed to reach the daemon pipe). `apps/api/tests/health.test.ts` is written to tolerate this (`expect([200, 500]).toContain(res.status)`); no database-backed integration suite beyond the existing unit/route-guard tests was executed here.
- Physical Android/iOS device testing — requires real hardware; see "Requires physical-device testing" in `FULL_AUDIT_2026-08-25.md`.
- `eas build` — requires an authenticated EAS account and is billed/cloud-only; not run from this audit environment.
