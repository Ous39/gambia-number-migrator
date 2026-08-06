# GNM v2.8.3 UI Notice Spacing Fix

## Resolved issue

Warning, safety, privacy, notification, and informational notice cards were rendered without outer vertical spacing. This caused them to appear attached to nearby tool buttons, search fields, notification content, and Settings cards.

## Implementation

The shared `NoticeCard` component now applies a consistent 12-point vertical margin. Because the correction is part of the reusable component, it covers every current and future notice card without screen-specific workarounds.

Confirmed affected areas include:

- Dashboard: **Free access** below **More tools**
- Notification inbox: inbox guidance above notification content
- Remove Old Duplicates: **Safety rule** above the search field
- Settings: **You are in control**, **Support diagnostics**, and **Never share payment PINs**
- Backup, payment, onboarding, scan-complete, and checkout notices

## Release identifiers

- App version: 2.8.3
- Android version code: 31
- iOS build number: 31
