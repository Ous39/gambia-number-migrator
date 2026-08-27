# GNM — Pull, Build & Store Release Runbook

Current `main`: website v2 + Wave Checkout (disabled) + admin device grant + logo/branding.
Companion docs: `STORE_RELEASE.md`, `GNM-v1.0.0-GOOGLE-PLAY-INTERNAL-TESTING.md`,
`GNM-v1.0.0-APPLE-TESTFLIGHT.md`, `GNM-v1.0.0-VPS-DEPLOYMENT.md`,
`WAVE_DEPLOYMENT_AND_ROLLBACK.md`, `ANDROID_PUSH_SETUP.md`.

Identity (do **not** change after store records exist):
- App name **GNM** · Android `gm.oceanbrown.gnm` · iOS `gm.oceanbrown.gnm`
- Production API `https://api.oceanbrown.gm/api` · EAS project `2f1a4344-3c29-466d-a773-56355f9d4994`

---

## 0. Prerequisites (one-time)

- Node 22, `pnpm` (`corepack enable`), Git.
- `npm i -g eas-cli` and `eas login` (Expo account that owns the project id above).
- **Apple**: Apple Developer Program membership; an App Store Connect app record with bundle id `gm.oceanbrown.gnm`.
- **Google**: Play Console; an app record with package `gm.oceanbrown.gnm`; a Google **service-account JSON** for `eas submit` (or submit the `.aab` by hand the first time).
- **Optional (push)**: `apps/mobile/google-services.json` + FCM v1 key uploaded via `eas credentials`. Android store build succeeds without it; push just won't deliver until it's added. See `ANDROID_PUSH_SETUP.md`.

---

## 1. Pull

```bash
git clone https://github.com/Ous39/gambia-number-migrator.git   # first time
cd gambia-number-migrator
git checkout main
git pull
pnpm install --frozen-lockfile
pnpm --filter @gnm/shared build
```

## 2. Verify the checkout locally

```bash
pnpm typecheck          # shared, api, admin, web, mobile
pnpm test               # api 69 · web 6 · mobile 43 · admin 7 · shared 18
pnpm build              # api (tsc) · admin · web · mobile (expo export)
```
All must pass before you build for stores.

## 3. Deploy the backend FIRST (the app needs the live API)

On the VPS:
```bash
cd /path/to/gambia-number-migrator
git pull
# .env.production must have: strong JWT_SECRET (>=32, non-placeholder), DATABASE_URL,
# CORS_ORIGIN=<real admin origin>, PUBLIC_SITE_URL=https://gnm.oceanbrown.gm (optional),
# PAYMENT_TEST_MODE=false, PAYMENT_PROVIDER_INTEGRATION_READY=false  (Wave stays off)
pg_dump "$DATABASE_URL" -Fc -f gnm_backup_$(date +%Y%m%d).dump   # back up first
docker compose -f docker-compose.production.yml up -d --build
```
The API container runs `db:migrate` on start and applies migrations through **027**
(025/026 = Wave payment columns + D25 consistency, 027 = website updates). All are
forward-only and idempotent.

Verify:
```bash
curl -s https://api.oceanbrown.gm/api/health
curl -s https://api.oceanbrown.gm/api/public/status
```
Confirm the public site loads and `https://gnm.oceanbrown.gm/privacy`, `/terms`,
`/data-deletion` return HTTPS 200.

## 4. Bump the app version

`autoIncrement: true` in `eas.json` (production) auto-increments `android.versionCode`
and `ios.buildNumber` in `app.json` on each build. You still set the user-facing version:

- `apps/mobile/app.json` → `"version"`: `1.0.0` → **`1.1.0`** (or your choice).
- Commit the bump:
  ```bash
  git commit -am "release: GNM 1.1.0" && git push
  ```

## 5. Build the store binaries (EAS)

```bash
cd apps/mobile
eas project:info                       # sanity: correct project + owner
eas build --profile production --platform android    # -> .aab, store channel
eas build --profile production --platform ios        # -> .ipa, store channel
```
Production profile bakes in `EXPO_PUBLIC_API_BASE_URL=https://api.oceanbrown.gm/api`
and `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`. **Store channel = Wave/APS hidden,
free-launch screen only.** No IAP is configured because the store edition takes no payment.

(First run, EAS prompts to generate/manage signing credentials — accept for both platforms.)

## 6. Test the exact store build on a real device

- **Android**: `eas submit --profile production --platform android --latest` → lands on the
  **Internal testing** track as a **draft** (per `eas.json`). Add testers in Play Console,
  install, verify update path.
- **iOS**: `eas submit --profile production --platform ios --latest` → App Store Connect →
  **TestFlight**. Install on a physical device.

On device, confirm:
- Payment screen shows **Free Launch Access** only — no Wave, no APS, no "setup pending".
- Set Admin → App configuration → Campaign mode = **Free for everyone**; a fresh install gets
  server-confirmed full access.
- Scan → preview → backup → migrate → restore all work against the production API.
- Notifications: in-app completion notifications fire. Remote push only if step 0's Firebase
  credentials are in place.

## 7. Promote to production review

- **Google Play**: Play Console → promote the internal build to Production. Complete Data
  Safety (contacts processed on-device, not shared/sold), content rating, target audience,
  ads declaration, `READ_CONTACTS`/`WRITE_CONTACTS` permission declaration (core feature:
  contact migration), privacy policy `https://gnm.oceanbrown.gm/privacy`, support contact.
- **App Store**: App Store Connect → submit the TestFlight build for review. App Privacy =
  contacts used on-device, not linked to identity, not for tracking. Review Notes:
  "Contact processing is entirely on-device; contacts are never uploaded. Access is free
  during the launch campaign — no in-app purchase is present in this build."

## 8. Rollback

- App: no OTA channel is used; a bad store build is fixed by submitting a new build.
- Backend: `docker compose ... up -d` the previous image tag. Migrations 025–027 are additive —
  leave them. Restore `gnm_backup_*.dump` only for a true schema problem.
- Website: it's static; redeploy the previous `apps/web` build.

---

### Local "run it" (no store build)

```bash
docker compose up -d                     # postgres on 5434
pnpm --filter @gnm/api db:migrate
pnpm --filter @gnm/api dev &              # API on :8089
pnpm --filter @gnm/web dev &              # website on :5174
pnpm --filter @gnm/admin dev &            # admin on :5173
cd apps/mobile && pnpm start             # Expo — press a/i, or scan with a dev build
```
Note: the `store` gating and remote push need a real dev/preview build, not Expo Go:
`eas build --profile preview --platform android` gives an installable APK on the `direct`
channel (Wave/APS visible for local payment testing).
