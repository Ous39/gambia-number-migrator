# Testing Guide - Gambia Number Migrator

## 1. Start the project

Run:

```bat
RUN_THIS_FIRST.bat
START_ALL.bat
```

The scripts will attempt to start PostgreSQL on port `5434`, run migrations, seed admin data, start the API, admin panel, and Expo mobile app.

## 2. Check API health

Open:

```text
http://localhost:8089/api/health
```

Expected when database is ready:

```json
{ "ok": true, "database": "connected" }
```

If you see `database: disconnected`, the API is running but PostgreSQL is not reachable. Open Docker Desktop and run `START_ALL.bat` again.

## 3. Test backup loading

1. Open the mobile app.
2. Go to Backups.
3. Press `Create Full Backup`.
4. Confirm you see:
   - Spinner
   - Progress bar
   - `Creating Backup...` button
   - Restore buttons disabled during backup
5. Confirm it navigates to Backup Complete.

## 4. Test old migration backup

1. Scan contacts.
2. Go to Preview.
3. Select ready contacts.
4. Press Migrate Selected.
5. Complete migration.
6. Go to Backups.
7. Confirm an Old Migration Backup exists.
8. Press Restore and confirm old numbers can be restored.

## 5. Test payment checkout

1. Go to Subscription.
2. Select Wave or APS.
3. Continue to checkout.
4. Enter a 7-digit number, for example `3000000`, or a 9-digit number, for example `863000000`.
5. Confirm `Pay D100` becomes active.
6. Enter more than 9 digits and confirm the app trims/rejects extra digits.
7. Press `Pay D100`.
8. Enter the 4-digit test OTP shown in the popup.
9. Confirm payment success.

## 6. Admin test

1. Confirm PostgreSQL is running.
2. Open `http://localhost:5173`.
3. Login with:

```text
admin / admin12345
```

If login returns 500 and logs show `ECONNREFUSED 127.0.0.1:5434`, PostgreSQL is not running or not ready.

## Payment UI retest checklist

- Open Payment.
- Confirm only Wave and APS are visible.
- Confirm the page looks like a professional mobile checkout, not a basic form.
- Select Wave and continue.
- Enter fewer than 7 digits; `Pay D100` should stay disabled.
- Enter exactly 7 digits; `Pay D100` should enable.
- Enter 8 digits; `Pay D100` should disable.
- Enter exactly 9 digits; `Pay D100` should enable.
- Paste more than 9 digits; the app should trim to 9.
- Press `Pay D100`, enter the shown OTP, and confirm success.
- Repeat with APS.

## Startup retest checklist

### Docker Desktop closed
- Close Docker Desktop.
- Run `START_ALL.bat`.
- Confirm the script gives a clear Docker warning.
- Confirm it does not run migrations/seed and flood the terminal with PostgreSQL `ECONNREFUSED` errors.

### Docker Desktop open
- Open Docker Desktop and wait until it is running.
- Run `START_ALL.bat`.
- Confirm PostgreSQL starts on port 5434.
- Confirm migrations and seed run.
- Confirm `http://localhost:8089/api/health` shows `database: connected`.
