# GNM — Store Submission Checklist (free release, no payments)

You can ship GNM to Google Play and the App Store **now**, before Wave/APS. The `production` EAS
profile builds the `store` channel, which **removes Wave and APS entirely** and shows the
free-launch access screen — so the store version is a free app with **no in-app purchase**. That is
the simplest possible review. Add payments later, only to the `direct` / web channel.

Identity (do not change after store records exist): app **GNM** · id `gm.oceanbrown.gnm` (both
platforms) · EAS project `2f1a4344-3c29-466d-a773-56355f9d4994` · public version **1.1.0**.

---

## 1. Code / build — ✅ done

- [x] `app.json` `version` = `1.1.0`; `versionCode` / `buildNumber` auto-increment on each production build.
- [x] Icon, adaptive icon (dark-green bg), splash — the GNM logo.
- [x] iOS `NSContactsUsageDescription` and `ITSAppUsesNonExemptEncryption: false` set.
- [x] Android permissions: `READ_CONTACTS`, `WRITE_CONTACTS`, `POST_NOTIFICATIONS`.
- [x] `store` channel hides Wave/APS; free-launch screen only; no IAP code path.
- [x] `expo export` build succeeds; no server secrets in the bundle.
- [x] "Update available" notice on the dashboard when `minimum_app_version` is higher than the
      installed version (non-blocking; opens the store URL if set in Admin).
- [x] Website legal pages routable: `/privacy`, `/terms`, `/refunds`, `/data-deletion`.

## 2. Before the first build

- [ ] Set **Admin → App configuration → Support & legal**: real support email/phone/WhatsApp, and
      `Privacy policy URL` / `Terms URL` pointing at `https://gnm.oceanbrown.gm/...`.
- [ ] Set **Admin → App configuration → In-app messages → Minimum app version** to `1.1.0`
      (not higher, or every install shows the update notice).
- [ ] Set **Admin → App configuration → Free-access campaign** = `Free for everyone` (or `First N`).
- [ ] Confirm `https://api.oceanbrown.gm/api/health` and the website pages return HTTPS 200.
- [ ] (Optional, for Android push later) add Firebase — `ANDROID_PUSH_SETUP.md`. Not required to submit.

## 3. Build & internal test

```bash
cd apps/mobile
eas login
eas build --profile production --platform android    # -> .aab
eas build --profile production --platform ios         # -> .ipa  (accept EAS-managed signing + APNs)
```

- [ ] Install both on a **physical device**.
- [ ] Verify: onboarding → contact permission → scan → preview → back up → migrate → restore.
- [ ] Verify the payment screen shows **Free Launch Access only** — no Wave, no APS, no “setup pending”.
- [ ] Verify in-app "migration complete" notification fires.
- [ ] Confirm the app talks to `https://api.oceanbrown.gm/api` (production).

```bash
eas submit --profile production --platform android --latest   # -> Play internal track (draft)
eas submit --profile production --platform ios --latest        # -> TestFlight
```

## 4. Google Play Console — you must complete

- [ ] Create the app record for `gm.oceanbrown.gnm`.
- [ ] **Permissions declaration** for `READ_CONTACTS` / `WRITE_CONTACTS` — required. Reason:
      *core functionality — the app reads the user's contacts to detect eligible Gambian numbers and
      writes updates the user explicitly approves. Contacts are processed on-device and never uploaded.*
- [ ] **Data safety** form:
  - Data collected: **Device or other IDs** (random per-install id), **App info & performance**
    (app version, OS, crash-free events), **App activity** (access status). Approx location = No.
  - Contacts: **processed on-device, not collected / not shared.**
  - "Is all user data encrypted in transit?" **Yes** (HTTPS).
  - "Do you provide a way to request data deletion?" **Yes** → `https://gnm.oceanbrown.gm/data-deletion`.
- [ ] Content rating questionnaire (no violence/gambling/etc. → likely Everyone / PEGI 3).
- [ ] Target audience & content (adults; not designed for children).
- [ ] Ads: **No**.
- [ ] Store listing: short + full description, app icon (done), **feature graphic (1024×500)**,
      **phone screenshots** (reuse the app screenshots), category (Tools / Communication).
- [ ] Countries: The Gambia (+ any others you want).
- [ ] App access: if any screen needs login/campaign — provide reviewer instructions
      ("access is free during the launch campaign; no login required").
- [ ] Upload the `.aab` to Internal testing, then promote to Production for review.

## 5. App Store Connect — you must complete

- [ ] Create the app record for `gm.oceanbrown.gnm`.
- [ ] **App Privacy**: Contacts — *used for App Functionality, not linked to the user's identity,
      not used for tracking.* Identifiers (device id) — App Functionality. Diagnostics — App Functionality.
- [ ] Age rating questionnaire (→ 4+).
- [ ] Export compliance: uses standard encryption only → **exempt** (`ITSAppUsesNonExemptEncryption`
      already `false`).
- [ ] App description, subtitle, keywords, **support URL** (`https://gnm.oceanbrown.gm/support`),
      **marketing/privacy URL** (`/privacy`).
- [ ] Screenshots for the required device sizes (6.7" and 6.5" / 5.5" iPhone).
- [ ] **Review notes**: *"Contacts are processed entirely on-device and are never uploaded. GNM is
      free during the launch campaign — this build contains no in-app purchase. To test: allow
      contact access, run a scan, review the preview, then migrate. Restore is available from the
      History screen."*
- [ ] Submit the TestFlight build for review.

## 6. Not needed for this release

- Google Play Billing / Apple IAP — the store build takes no payment.
- Wave / APS credentials, `/payment/success` pages in the app flow — only for the direct/web channel later.
- A privacy manifest beyond what Expo SDK 54 generates — run `npx expo-doctor` in `apps/mobile`
  and check the first EAS build log; add explicit reasons only if Apple flags a "required reason" API.

## 7. After approval

- Put the live store URLs into **Admin → Website Content → Links & social** so the website
  download badges activate.
- Bump `minimum_app_version` only when you actually ship a build users must upgrade to.
