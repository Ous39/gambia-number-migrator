# GNM v2.8.4 Full Audit and Preservation Report

## Source packages

- `GNM-v2.8.1-BACKUP-DUPLICATES-FIXED-VERIFIED(1).zip` was used as the feature-completeness baseline.
- `GNM-v2.8.3-UI-SPACING-FIXED-VERIFIED.zip` was used as the approved mobile UI and spacing baseline.

## Critical regression corrected

The v2.8.3 package omitted database migration `015_notification_audiences_and_controls.sql` and replaced the full admin notification workflow with a reduced platform-only workflow. Version 2.8.4 restores the complete feature set without removing the v2.8.3 shared notice-card spacing correction.

## Preserved approved UI

- Shared `NoticeCard` vertical spacing remains enabled across all mobile screens.
- Updated backup-complete and duplicate-cleanup layouts remain from v2.8.3.
- Notification controls remain under Settings with standard OS permission behavior.
- Notification inbox remains for received messages rather than permission setup.

## Restored full features

- Admin audiences: all eligible users, free-trial users, and subscribed users.
- Android-only, iOS-only, or both-platform targeting.
- Live Android/iOS notification preview.
- Notification history with Enable and Disable controls.
- Fixed admin top navbar with System Owner identity, theme control, and Logout.
- Database migration 015 for notification audience and enabled-state fields.
- API filtering by user subscription status and device platform.
- Server-side mobile notification opt-out endpoint.
- Existing backup, restore, and duplicate-removal implementation from the verified baselines.

## Release identifiers

- Project and app version: 2.8.4
- Android version code: 32
- iOS build number: 32

## Dependency audit note

All remediable dependency findings were updated. The package audit currently reports one React Router advisory affecting React Server Components action execution. This admin portal is a client-rendered Vite SPA and does not use React Server Components or server actions, so the affected execution path is not present. The advisory currently lists React Router 8.3.0 as the patched version, but that version is not published; the project uses the latest published `react-router-dom` 7.18.2 and should upgrade again when a compatible patched release becomes available.
