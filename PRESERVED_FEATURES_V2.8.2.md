# GNM v2.8.2 Preserved Features and Latest Updates

This package was rebuilt from `GNM-v2.8.1-BACKUP-DUPLICATES-FIXED-VERIFIED` so established functionality remains the baseline.

## Preserved from v2.8.1

- Android backup and restore fixes.
- Duplicate-number detection and removal fixes.
- Admin push-notification publishing.
- Notification audiences: all eligible users, free-trial users, and subscribed users.
- Notification platform targeting: Android, iOS, or both.
- Android/iOS notification preview.
- Notification history with per-message Enable and Disable controls.
- Fixed admin navbar containing administrator identity/System Owner, dark or light mode, and Logout.
- Existing migration, payments, operator, rules, transition, team, device, and audit features.

## Latest audited updates added

- Notification permission and preferences are managed from the mobile Settings page.
- Removed the separate onboarding notification-permission page.
- Removed automatic notification permission requests and foreground re-registration.
- Added Allow Notifications, Turn Off Notifications, and Open Phone Settings actions.
- Turning notifications off deactivates the device push token on the API.
- The notification inbox contains received messages only.
- Updated patched dependencies and production build configuration.
- Version 2.8.2, Android version code 30, and iOS build number 30.

## Expected admin notification workflow

Open **Notifications**, enter a title and message, choose the user audience and phone platform, inspect the preview, then publish. Sent records remain in Notification History and can be disabled or enabled. Disabling a record removes it from the in-app feed; a push already delivered to a phone cannot be recalled.
