# GNM v2.8.1 — Notification and Admin Upgrade

## Mobile

- Notification permission now has a dedicated, plain-language consent screen after contact permission.
- The operating-system notification prompt only appears after the user taps **Allow Notifications**.
- **Not Now** continues into the app without blocking contact migration.
- Settings includes an **Allow Notifications** control for users who skipped onboarding.
- App startup only refreshes an already-granted notification token and never triggers a surprise permission prompt.

## Admin

- Notification audience supports **All eligible users**, **Users using free trial**, and **Subscribed users**.
- Android/iOS platform targeting remains separate from the user audience.
- Notification history supports disabling and re-enabling a message.
- Disabled messages no longer appear in the mobile in-app notification feed. Alerts already delivered by the phone operating system cannot be recalled.
- System Owner identity, Dark/Light mode, and Logout were moved from the sidebar to a fixed top navbar.

## Deployment

- Run database migration `015_notification_audiences_and_controls.sql` before deploying the upgraded API and Admin.
- Build and test notification permission and delivery using an installed development/production build; remote push is not supported by current Expo Go Android versions.
