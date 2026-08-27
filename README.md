# GNM

GNM (Gambia Number Migrator) is OceanBrown's privacy-first Android and iOS application for safely updating eligible Gambian telephone contacts from the approved 7-digit plan to the new 9-digit plan.

## Release

- Store name: **GNM**
- Public mobile version: **1.0.0**
- Internal source/API/Admin/Website release: **2.10.0**
- Android package: `gm.oceanbrown.gnm`
- iOS bundle ID: `gm.oceanbrown.gnm`
- Android version code: `40` (EAS production builds auto-increment)
- iOS build number: `39` (EAS production builds auto-increment)

## Applications

- `apps/mobile` — Expo/React Native mobile application
- `apps/admin` — React administration console
- `apps/web` — public marketing website (`gnm.oceanbrown.gm`)
- `apps/api` — Express/PostgreSQL API
- `packages/shared` — shared validation and migration-rule engine
- `database/migrations` — ordered SQL migrations

## Public website

`apps/web` is the public site at `gnm.oceanbrown.gm`: home, number-format checker, safety/how-it-works, FAQ, team, privacy, terms, support and a contact form. It calls the same API as the mobile app and Admin — support contact details come from the live `app_config` (the same values shown in the mobile app's Settings screen), and the contact form, announcements, FAQs and team roster are managed from the Admin Portal under **Website Content** and **Enquiries** (Owner/Admin/Communications roles). It runs on port `5174` locally and is deployed the same way as Admin — a Vite production build served by Nginx (`Dockerfile.web`, `deploy/nginx-web.conf`).

## Launch configuration

The store release is free during the launch campaign. Migration `021_free_store_launch.sql` sets:

- Campaign mode to `all`
- Contact Migration Pass reference price to D25
- Wave and APS visibility to disabled
- A free-launch announcement

Store builds do not show unfinished payment functionality. Direct development builds retain the secured Wave/APS test flow for future approved integrations.

## Quick local start on Windows

1. Install Node.js 20+ and Docker Desktop.
2. Double-click `RUN_THIS_FIRST.bat` once.
3. Save the generated local Admin password shown in the setup window.
4. Double-click `START_ALL.bat`.
5. Open `http://localhost:5173` and scan the Expo QR code using a phone on the same network.

Read [LOCAL_TESTING.md](LOCAL_TESTING.md) for detailed testing, [DEPLOYMENT.md](DEPLOYMENT.md) for VPS deployment, and [STORE_RELEASE.md](STORE_RELEASE.md) before uploading builds.

## Security and privacy

Contacts, contact names and phone numbers are processed on the user's device and are not uploaded. The API stores only operational device references, access status, support diagnostics, push tokens and payment records. Device-protected requests use one-time device secrets stored as SHA-256 hashes on the server.

Never commit `.env`, signing keys, service-account keys, Apple keys or production webhook credentials.
