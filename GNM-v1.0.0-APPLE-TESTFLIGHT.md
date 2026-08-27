# GNM v1.0.0 — Apple TestFlight

This document prepares GNM for **TestFlight only**. It does not claim App Store production approval — that is Apple's decision, made after their review.

## 1. Prerequisites confirmed in source

- Bundle identifier: `gm.oceanbrown.gnm` (`apps/mobile/app.json`)
- Version: `1.0.0`, buildNumber `40` — **confirm this is unused** via `eas build:list --platform ios` and App Store Connect's own build-number history for this identity before submitting; bump if needed (see `GNM-v1.0.0-FINAL-AUDIT.md` §1).
- `ITSAppUsesNonExemptEncryption: false` already set in `infoPlist` — correct for an app using only standard HTTPS/TLS, avoiding an unnecessary export-compliance document upload.
- `NSContactsUsageDescription` present and accurate: *"GNM scans contacts locally so you can preview and safely update Gambian numbers. Contacts are never uploaded."*
- Production API: `https://api.oceanbrown.gm/api`, distribution channel `store` — same review-mode/payment-hiding behavior as Android, verified in `app/payment.tsx:11` (channel-based, not platform-based, so this logic is identical on iOS).

## 2. Apple Developer account setup (outside this environment)

1. Register the bundle identifier `gm.oceanbrown.gnm` in the Apple Developer portal, under the correct team.
2. Create/confirm a distribution certificate and provisioning profile for this identifier — or let `eas build` manage this interactively (`eas credentials`).
3. Create the App Store Connect app record under this bundle identifier. Because the identifier changed from the previous release, this is a new app record — it does not inherit the old app's TestFlight/App Store history.

## 3. Build

```bash
cd apps/mobile
eas login
eas build --platform ios --profile production
```

Not run from this environment — requires a real Apple Developer Program membership and EAS credentials. EAS will prompt for (or reuse configured) signing credentials.

## 4. Icons and splash assets

Confirm `apps/mobile/assets/icon.png` and the adaptive/splash assets meet Apple's current size and format requirements (no alpha channel on the App Store icon, correct corner-radius-free square export — Apple applies the mask itself). These are the same asset files used for both platforms; verify them once, not twice.

## 5. Permissions

- Contacts: prompt text confirmed above, and the onboarding flow (`app/onboarding.tsx`) explains *why* access is needed and that contacts stay local **before** the permission system prompt appears, which is exactly the pattern Apple's review guidelines expect.
- Notifications: requested via a dedicated `notification-permission.tsx` screen, after onboarding, with its own explanation before the system prompt — not requested immediately on first launch.

## 6. Review-mode verification checklist (must be true before submitting)

Same underlying config as Android — `free_access_mode = all` is a server-side setting, not a platform-specific one:

- [ ] `free_access_mode = all` in the live production Admin config
- [ ] A freshly installed build reaches full Dashboard access with only the contacts/notification permission prompts — no payment, no OTP, no review code
- [ ] Wave and APS are not shown anywhere in this build (distribution channel `store`)
- [ ] Scanning, Preview, Backup, Migration, Restore, Duplicate Cleanup, History, Notifications and Settings all reachable and functional

## 7. Submit to TestFlight

```bash
eas submit --platform ios --profile production
```

Or upload the `.ipa` manually via Transporter / Xcode Organizer. In App Store Connect, add the build to a TestFlight group and fill in:

- **What to test**: mention that contact processing is entirely local and the launch campaign provides free full access — reviewers do not need a purchase or code.
- **Review notes**: explicitly state the app requests Contacts and Notifications permissions, explain why, and confirm no login/account is required.
- Internal or external TestFlight testers, per your rollout plan. Install-test on at least one physical iPhone before considering a wider release.

## 8. What this document does not certify

It does not certify that the build was actually produced, signed, uploaded, or approved — those require a real Apple Developer account, real EAS/Apple credentials, and Apple's own review, none of which are available from this environment. It gives the exact commands and the exact things to verify once you have access to run them.
