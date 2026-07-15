# Gambia Number Migrator

Current audited release: **v1.9.4**. This release improves iOS button typography and adds privacy-aware support diagnostics, searchable support codes, payment/device troubleshooting and verified paid-access restoration. Apply database migrations `001` through `011` before running this version.

Gambia Number Migrator is a privacy-first monorepo application for helping users in The Gambia migrate saved contacts from old 7-digit mobile numbers to the new 9-digit format.

The app is designed around the transition period from **2026-09-04** to **2026-11-30**, where the safest default is to **add the new 9-digit number while keeping the old 7-digit number**. After the transition, users can run **Remove Old Duplicates** to remove verified old numbers only when the matching new number exists in the same contact.

## Apps

- `apps/api` — Node.js + Express + TypeScript backend on port `8089`
- `apps/admin` — React + Vite admin panel on port `5173`
- `apps/mobile` — Expo React Native mobile app
- `packages/shared` — shared TypeScript rule engine, validators, types, transition helpers
- `database` — PostgreSQL migrations and seed SQL

## Default admin

- URL: `http://localhost:5173`
- Username: `admin`
- Password: value of `ADMIN_INITIAL_PASSWORD` in your `.env`

Change this password before production.

## Main features

- Admin-configurable operators and migration rules
- Publishable rule versions
- Public rules endpoint for mobile
- Public transition settings endpoint for mobile
- Local-only contact scanning and backups
- Duplicate/Add Mode
- Replace Mode with warning
- Remove Old Duplicates safety workflow
- Mock/manual payment provider abstraction
- Wave and APS webhook endpoints prepared
- Audit logs
- Windows batch scripts

## Quick start

```bash
pnpm install
pnpm --filter @gnm/shared build
docker compose up -d
pnpm --filter @gnm/api db:migrate
pnpm --filter @gnm/api db:seed
pnpm --filter @gnm/api dev
pnpm --filter @gnm/admin dev
pnpm --filter @gnm/mobile start
```

Or on Windows, double-click `RUN_THIS_FIRST.bat`.

## One-click Windows testing

1. Double-click `RUN_THIS_FIRST.bat` once to create the local environment, install packages and prepare PostgreSQL.
2. Double-click `START_ALL.bat` whenever you want to test. It starts the API, Admin and Expo Mobile windows and opens the Admin URL.
3. Double-click `STOP_ALL.bat` when finished. It closes only the named GNM service windows and stops PostgreSQL without deleting its data.

Individual launchers remain available as `START_API.bat`, `START_ADMIN.bat` and `START_MOBILE.bat`. `RESET_DATABASE.bat` is destructive and requires typing `RESET` before it clears local database records.

## Logic Added From Uploaded Project

This version includes a safety-focused logic merge from the uploaded Gambia Contact Migrator project:

- Device fingerprinting for premium unlock/payment status.
- Device registration/status API endpoints that do not receive contact data.
- Safer local phone matching for `+220`, `220`, spaced, hyphenated, 7-digit, and 9-digit formats.
- Chunked scan progress for large phonebooks.
- Stable preview/cleanup selection keys so filtering cannot change the wrong selected row.
- Cleanup re-verification with current migration rules before any old number is removed.

## SDK 54 / Expo Go note
The mobile app is now configured for Expo SDK 54 so it works with the current Expo Go app. If you test on a real phone and see `Network request failed`, remember that `localhost` on the phone is the phone itself, not your PC. Start the API, keep your phone and PC on the same Wi-Fi/hotspot, then either:

1. Let the app auto-detect the Expo LAN host, or
2. Set `EXPO_PUBLIC_API_BASE_URL` to your PC LAN IP, for example `http://172.16.50.144:8089/api`.

Quick mobile start:

```powershell
cd "C:\Users\OUSMAN JALLOW\Documents\gambia-number-migrator\apps\mobile"
$env:EXPO_NO_DEPENDENCY_VALIDATION="1"
npx expo start --clear --port 8082
```


## Premium UI Refresh

This version includes a full mobile and admin UI refresh based on the premium navy/cyan design reference. The mobile app now has a global theme system with System, Light, and Dark modes. Open **Settings → Appearance** to switch modes.

Key refreshed mobile screens include Dashboard, Preview Changes, Scan Complete, Backups, Migration History, Remove Old Duplicates, Premium Unlock, Settings, and Migration Complete.


## Mobile runtime hotfix

This package includes a fix for the Expo SDK 54 root layout crash. Start mobile with:

```powershell
cd apps\mobile
$env:EXPO_NO_DEPENDENCY_VALIDATION="1"
npx expo start --clear --port 8082
```

## If Expo still shows an old error

Delete the old `gambia-number-migrator` folder before extracting this ZIP. Do not copy this ZIP over an existing folder. Old files from previous versions can remain and cause errors such as `useAppTheme is not a function`.

```powershell
cd "C:\Users\OUSMAN JALLOW\Documents"
Remove-Item -Recurse -Force .\gambia-number-migrator
```


## Full Mobile UI Professional Upgrade

The mobile application now uses a more professional responsive app UI. The Preview Changes screen has a fixed search/operator filter area and an always-visible migration button, while the dashboard has been redesigned as a command center. See `docs/FULL_UI_PRO_UPGRADE.md`.

## Latest patch notes - 2026-07-09

This build improves the backup flow, Wave/APS payment checkout styling, and API behavior when PostgreSQL is not ready.

- Backups now show a full progress card and progress bar while saving contacts locally.
- Wave/APS checkout now uses a styled +220 phone-number input and a larger `Pay D100` button.
- Payment phone numbers must be exactly 7 or 9 digits.
- Public mobile API routes return fallback test config if PostgreSQL is temporarily down.
- Admin login still requires PostgreSQL and seed data.

## Important Docker note

If you see a Docker pipe error such as `dockerDesktopLinuxEngine: The system cannot find the file specified`, Docker Desktop is installed but not running. Open Docker Desktop first, wait for it to fully start, then run `START_ALL.bat` again.

The mobile app can still test fallback rules without PostgreSQL, but Admin login requires PostgreSQL and seed data.
