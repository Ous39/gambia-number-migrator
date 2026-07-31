# Gambia Number Migrator — Full Audit v2.6.0

Date: 2026-07-21

## Implemented

- Payment selection, phone entry, OTP verification, success receipt, and paid-device refresh were reviewed and updated.
- Dashboard no longer renders Full Unlock after confirmed payment.
- Free users are limited by the API to 10 contact migrations in Add & Keep Old mode; Preview also limits the selection before submission.
- Manual Backup/Restore, Replace, and Cleanup require server-confirmed paid access.
- Automatic pre-migration snapshots remain enabled for safety, including for permitted free migrations.
- Backup chunk writes now roll back partial data after failure. Metadata is committed only after all chunks verify.
- Restore now re-reads each changed contact and verifies the resulting phone-number snapshot before reporting success.
- Notification setup failures are stored and shown in the app instead of being silently ignored.
- Android uses a maximum-importance notification channel with sound, vibration, badge, and public lock-screen visibility.
- The API validates Expo token format, deactivates superseded tokens for the same device/platform, and returns ticket rejection details to Admin.
- Firebase Android config is conditional so source validation works without secrets and EAS includes it when `apps/mobile/google-services.json` exists.

## Verification completed

- TypeScript: Mobile, API, Admin, and Shared passed.
- Automated tests: 10/10 passed.
- API TypeScript production compilation passed.
- Admin Vite production build passed.
- Expo public configuration resolved successfully for SDK 54.

## Production dependencies not contained in source

The test OTP payment flow is functional when `PAYMENT_TEST_MODE=true`. Live Wave and APS collection cannot be certified until official merchant API contracts, credentials, request signing, callback payloads, and settlement behavior are supplied. Production correctly requires test mode to be disabled.

Remote push also requires infrastructure owned by the project:

1. Firebase Android app package `com.oceanbrown.gambianumbermigrator`.
2. `apps/mobile/google-services.json` before the EAS build.
3. Valid FCM v1 service-account credentials configured for the EAS project.
4. A new Android binary after Firebase configuration changes.
5. Real-device testing outside Expo Go and API access to Expo Push Service.

The source now reports these registration failures to the user, but credentials cannot be generated or simulated in the repository.

## Release steps

1. Copy production `.env` values and keep all secrets out of Git.
2. Run `pnpm install`, migrations `001`–`013`, typecheck, tests, and builds.
3. Add the private Firebase client file and configure FCM v1 in EAS.
4. Run `eas build --platform android --profile preview` and install over the existing app with the same signing key.
5. Test free migration counts, paid unlock refresh, backup/restore, and an Admin notification on a physical Android device.
6. Deploy API/Admin only after the device tests pass.
