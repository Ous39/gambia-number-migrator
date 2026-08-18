# GNM Notification Production Update — v2.8.5

## Completed

- Android FCM V1 delivery is configured and verified (`Accepted: 1`, immediate failures: `0`).
- Admin audience selection is enforced by the API:
  - All eligible users
  - Users on free trial (`devices.status = trial`)
  - Subscribed users (`devices.status = active`)
- Platform targeting is enforced for Android, iOS, or both.
- Expo push ticket IDs are stored and can be checked later through **Check receipts**.
- Tokens rejected as `DeviceNotRegistered` are disabled automatically from immediate tickets and later receipts.
- Admin notification Disable/Enable now has a working API route and database field.
- Disabled notifications are removed from the in-app Inbox while already-delivered phone alerts remain unaffected.
- Android channel remains maximum priority with sound, vibration, public lock-screen visibility, and badges.

## Deployment

1. Commit and push this update to the repository connected to Railway.
2. Railway API pre-deploy must run `pnpm --filter @gnm/api db:migrate` so migration `015_notification_delivery_tracking.sql` is applied.
3. Deploy/restart the API and Admin services.
4. Send one Android-only notification, wait 15–30 seconds, then select **Check receipts**.
5. Test Free trial and Subscribed audiences using devices whose server statuses match those groups.

## External release gates

- Apple push testing requires an Apple Developer account and APNs credentials configured in EAS.
- Sound, vibration, lock-screen display, and background delivery require confirmation on physical devices.
- Rotate the previously exposed admin password; do not share the replacement in chat.
- Keep Firebase Admin SDK and Apple credential files out of Git and release archives.

