# Android Push Notifications — Setup

**Status:** App + server code is complete and correct. Android push **delivery** is blocked only by
missing Firebase/FCM credentials for the app id `gm.oceanbrown.gnm`. iOS push works once APNs
credentials are set in EAS. In‑app "migration complete" notifications already work with no setup.

## Why Android push currently does nothing

Expo's push service delivers Android notifications through **Firebase Cloud Messaging (FCM v1)**.
That needs two things that are not in this repo (correctly — they are secrets / per‑project):

1. `apps/mobile/google-services.json` — the Firebase Android app config. It was removed at v1.0.0
   because the old one was registered to the previous package name.
2. An **FCM v1 service‑account key** uploaded to EAS so Expo can call FCM on OceanBrown's behalf.

Without (1) the build has no FCM sender id; without (2) `exp.host/--/api/v2/push/send` returns an
error ticket and `device_push_tokens` rows get marked inactive.

## What the code already does (no change needed)

- `app.json` → `expo-notifications` plugin with `defaultChannel: "general"`, notification colour,
  `POST_NOTIFICATIONS` permission, `package: "gm.oceanbrown.gnm"`.
- `app.config.js` injects `android.googleServicesFile: "./google-services.json"` **automatically**
  as soon as that file exists — local dev and source audits keep working until then.
- `apps/mobile/src/services/notificationService.ts` creates the `general` channel, requests
  permission, fetches the Expo push token with the correct `projectId`, and registers it.
- `apps/mobile/app/_layout.tsx` now calls `ensureAndroidChannel()` on every launch so a push that
  arrives before the user opens Settings is still shown.
- `apps/api/src/routes/notifications.ts` sends via Expo push with `channelId: "general"`, handles
  tickets + receipts, and deactivates `DeviceNotRegistered` tokens.

## Steps for OceanBrown (one‑time)

### 1. Firebase project
1. https://console.firebase.google.com → **Add project** (e.g. "GNM").
2. **Add app → Android**. Package name: **`gm.oceanbrown.gnm`** (exactly). SHA‑1 is optional for FCM.
3. Download **`google-services.json`** → place it at **`apps/mobile/google-services.json`**
   (already git‑ignored via `**/google-services.json`). Do **not** commit it.

### 2. FCM v1 service‑account key
1. Firebase Console → **Project settings → Service accounts → Generate new private key** → download the JSON.
2. Upload it to EAS: from `apps/mobile/`, run
   ```bash
   eas credentials
   ```
   → platform **Android** → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **upload** the JSON.
   (Or set it once via `eas.json` → `submit`/`build` per Expo docs.)

### 3. iOS (if not already done)
```bash
eas credentials   # platform iOS → Push Notifications → let EAS manage the APNs key
```

### 4. Rebuild
```bash
# from apps/mobile
eas build --profile preview --platform android    # or development / production
```
The build now contains `google-services.json`; Expo push routes through FCM v1.

### 5. Verify end‑to‑end
1. Install the new build on a **physical** Android phone (emulators without Play Services won't get a token).
2. In GNM → Settings → enable notifications. Confirm no error banner.
3. DB: `SELECT device_id, platform, active FROM device_push_tokens ORDER BY last_seen_at DESC;` → a row with `active = true`, `platform = 'android'`.
4. Admin → Notifications → send a test to `target: android`. Response should show `sent_count ≥ 1`, `status = 'sent'`.
5. Admin → Notifications → **Check receipts** a minute later → `receipt_ok_count ≥ 1`.
6. The phone shows the banner even with the app closed.

## Common failures

| Symptom | Cause |
|---|---|
| "The app server could not register this device" | API unreachable / device not registered first |
| Token obtained but no delivery; receipt `MismatchSenderId` | `google-services.json` is from a different Firebase project than the FCM key |
| Receipt `InvalidCredentials` | FCM v1 service‑account key not uploaded to EAS (or wrong project) |
| Nothing on the phone, `sent_count` ok | Battery optimisation / channel disabled in Android settings; DND |
| Works in dev build, not production | Different EAS credential set — run `eas credentials` for the production profile too |
| Expo Go shows "requires a development build" | Expected — Expo Go dropped remote push on SDK 53+. Use a dev/preview/prod build. |
