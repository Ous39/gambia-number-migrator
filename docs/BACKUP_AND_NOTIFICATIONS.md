# Backup and Notification Upgrade

## Backup guarantees

- Full and automatic pre-change backups are stored locally in versioned chunks of 100 contacts.
- A backup is verified before a migration or cleanup operation is allowed to continue.
- Restore validates that every expected chunk exists before changing any contact.
- Existing single-record backups remain supported.
- Users can delete backups, and old chunk data is cleaned when the 30-backup retention limit is reached.
- Clearing local app data also removes dynamic backup chunks.

Backups remain on the phone. Uninstalling the app or clearing its application data removes them. A future encrypted export feature would be required for off-device disaster recovery.

## Admin notifications

1. Run all database migrations, including `004_notifications.sql`.
2. Add `EXPO_PUBLIC_EAS_PROJECT_ID` to `.env`. This is the EAS project ID shown after `eas init`.
3. Build a development or production app. Remote push notifications are not supported in Expo Go on Android from SDK 53 onward.
4. Open the installed mobile app and allow notification permission. The app registers its device and Expo push token automatically.
5. In the admin portal, open **Notifications**, choose the audience, write the title/message, and select **Publish & Push Notification**.

Every published message is also available in the mobile notification inbox, including after a push delivery failure. The admin history records sent and failed push ticket counts.
