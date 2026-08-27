# GNM v1.0.0 — Google Play Internal Testing

This document prepares GNM for **Internal Testing only**. It does not claim Production approval — that is Google's decision, made after their review.

## 1. Prerequisites confirmed in source

- Package: `gm.oceanbrown.gnm` (`apps/mobile/app.json`)
- Version: `1.0.0`, versionCode `41` — **confirm this is unused** via `eas build:list --platform android` and the Play Console's own version-code history for this app before submitting; bump if needed (see `GNM-v1.0.0-FINAL-AUDIT.md` §1 for why this couldn't be confirmed from this environment).
- Production API: `https://api.oceanbrown.gm/api` (`eas.json` production profile)
- Distribution channel: `store` (`EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store` in `eas.json`) — this is what makes the app hide Wave/APS entirely and show the free-launch-access flow instead. Confirmed in code (`app/payment.tsx:11`), not just in build config.

## 2. Firebase — required before building

The shipped source does **not** include a `google-services.json` (the old one was scoped to the previous package name and would fail the build). Before running the production Android build:

1. In the Firebase console, add a new Android app to the project with package `gm.oceanbrown.gnm`.
2. Download the generated `google-services.json`.
3. Place it at `apps/mobile/google-services.json`. `app.config.js` picks it up automatically if present.

Without this, the app still builds and runs — local completion notifications work regardless — but remote push-token registration will report "unavailable" rather than crashing.

## 3. Build the AAB

```bash
cd apps/mobile
eas login
eas project:info   # confirm it resolves to project 2f1a4344-3c29-466d-a773-56355f9d4994
eas build --platform android --profile production
```

This was **not run from this environment** — it requires a real EAS account with Android signing credentials configured. `eas.json`'s production profile has `autoIncrement: true`, so EAS will bump `versionCode` further on each subsequent build automatically; the `41` set in `app.json` is the floor, not necessarily the exact number that ships.

## 4. Play Console — Internal Testing setup

1. Create the app under package `gm.oceanbrown.gnm` if it doesn't already exist under this identity (a package-name change means this is a new app record on Play Console — it cannot reuse the old `com.oceanbrown.gambianumbermigrator` listing's history).
2. Store listing: app name **GNM**, short/full description, icon (`apps/mobile/assets/icon.png`), feature graphic, phone screenshots. **Screenshots must match the current UI** — capture them from an actual build of this release, not the previous version.
3. Content rating questionnaire: answer accurately for a contact-management/utility app.
4. Target audience: not primarily directed at children.
5. Ads declaration: **No ads** (none are implemented — confirm this remains true before submitting).
6. Government app declaration: **No**.
7. Financial features declaration: **No** — GNM itself is not a financial service; it does not process payments in the store build (§5 below confirms Wave/APS are hidden in `store` channel builds).
8. Health features declaration: **No**.
9. Data Safety form: must match what the app and server actually do (see `GNM-v1.0.0-FINAL-AUDIT.md` §7). Contacts are collected/processed on-device and not transmitted — declare accordingly. Device identifiers and payment status (if payments are ever added to a store build via real Play Billing) must be declared if collected.
10. Privacy Policy URL: `https://gnm.oceanbrown.gm/privacy`.
11. **App access declaration**: set to **"No part of the app is restricted"** — but only after confirming `free_access_mode = all` is actually set in production, and that a fresh install genuinely reaches full access with no login, OTP, payment, or review code (§5). If this is not genuinely true at submission time, do not make this declaration.

## 5. Review-mode verification checklist (must be true before submitting)

Set in the Admin portal, then verify against the running production API:

```bash
# Confirm live config
curl -s https://api.oceanbrown.gm/api/app-config | grep -o '"free_access_mode":"[^"]*"'
# Expect: "free_access_mode":"all"
```

- [ ] `free_access_mode = all` in the live production Admin config
- [ ] A freshly installed build, with no prior account, reaches full Dashboard access after only the contacts/notification permission prompts — no payment screen, no OTP, no review code (verified in code at `app/payment.tsx:11`, verify again on a real device before submitting)
- [ ] Scanning, Preview, Backup, Migration, Restore, Duplicate Cleanup, History, Notifications and Settings are all reachable and functional
- [ ] Wave and APS are not shown anywhere in this build (distribution channel `store`)

## 6. Upload to Internal Testing

```bash
eas submit --platform android --profile production
# or upload the .aab manually via Play Console > Internal testing > Create new release
```

Add tester emails/group, roll out to Internal Testing, and install-test on at least one physical Android device before considering any wider release.

## 7. What this document does not certify

It does not certify that the build was actually produced, uploaded, or approved — those require real EAS credentials, a real Play Console account, and Google's own review, none of which are available from this environment. It gives the exact commands and the exact things to verify once you have access to run them.
