# Local Testing

## Requirements

- Windows 10/11
- Node.js 20 or newer
- pnpm 9 or newer (`corepack enable` or `npm install -g pnpm`)
- Docker Desktop with the Docker engine running
- Expo Go for basic local UI/contact testing

## First setup

Double-click:

```text
RUN_THIS_FIRST.bat
```

The script creates `.env`, generates unique local JWT/Admin secrets, installs dependencies, starts PostgreSQL, applies migrations and seeds the fresh local database once. Save the displayed Admin password.

## Start and stop

- `START_ALL.bat` — API, Admin, Website and Mobile together
- `START_API.bat` — API and local database only
- `START_ADMIN.bat` — Admin only
- `START_WEB.bat` — public website only
- `START_MOBILE.bat` — Expo LAN mode
- `START_MOBILE_TUNNEL.bat` — fallback Expo tunnel mode
- `STOP_ALL.bat` — stop development windows and PostgreSQL container
- `FIX_PORTS.bat` — stop only GNM development ports
- `RESET_DATABASE.bat` — destructive local reset requiring typed confirmation

Ordinary start scripts run migrations but never reseed the database.

## URLs

- API health: `http://localhost:8089/api/health`
- Admin: `http://localhost:5173`
- Website: `http://localhost:5174`
- PostgreSQL: `127.0.0.1:5434`
- Expo: port `8082`

## Required test sequence

1. Log in as the owner and verify Admin navigation.
2. Confirm migration 019 sets Campaign mode to **Free for everyone**, price to **D25**, and both wallets off.
3. Verify all official operator rules and publish them.
4. Install/open the app, complete onboarding and grant Contacts/Notifications permissions.
5. Confirm the app registers the device and displays free launch access.
6. Test scan, preview, Add & Keep Old, backup, restore, duplicate cleanup and history.
7. Close and reopen the app; it must return to Dashboard, not Notifications.
8. Test System, Light and Dark themes plus small-screen scrolling.
9. Test at least 1,000 contacts; preferably test 5,000–10,000 contacts on a dedicated device.
10. Test Admin roles: viewer read-only, finance payments-only, operations rules/operators, support devices, communications website content/enquiries, owner full access.
11. Open the website at `http://localhost:5174`, submit the contact form, then confirm the enquiry appears under Admin → Enquiries. Publish an announcement and a FAQ under Admin → Website Content and confirm they appear on the public homepage.
12. Under Admin → Website Content → Team, add a team member with an uploaded photo. Confirm the photo appears on the public homepage team card, click "Read more" to confirm the profile page shows the photo and full biography, then edit the same member (change their role or swap the photo) and confirm the public page updates.

## Code verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expo Go cannot fully validate production push notifications, background behavior, native store signing or store review configuration. Use an internal Android build and TestFlight build for final testing.
