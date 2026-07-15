# Full App Audit Fix - Mobile + Admin

This update focuses on making the app behave like a polished production mobile app while keeping payment in UI/testing mode.

## Mobile fixes

- Reworked the dashboard into a cleaner MansaPay-style command center.
- Standardized the blue/white brand palette in light mode and dark mode.
- Fixed page top headers so back buttons and page names stay visible at the top.
- Reworked shared ListScreen behavior so only the page title/back header stays fixed, not the full page content.
- Improved Android spacing, bottom tab elevation, safe-area padding and fixed action bars.
- Removed the hard subscription lock from test migration so selected contacts can be migrated during testing.
- Kept the payment/subscription page as a UI test flow only.
- Kept contact processing local on the device.
- Improved Preview page behavior: fixed search/operator filter area, visible migration action, operator-specific selection, and backup-before-update confirmation.
- Improved Cleanup page testing behavior and fixed the header layout.

## Admin fixes

- Added safer admin API client with clear network and session-expired handling.
- Added automatic login redirect when admin token expires.
- Added a mock payment route page for checkout references.
- Fixed Rules page loader so it no longer returns undefined where a Promise was expected.
- Improved Payments page flow, mock/manual confirmation feedback and empty-state behavior.
- Improved Dashboard metrics to use the actual transition settings returned by the API.
- Upgraded admin CSS to match the MansaPay-style blue/white visual system.
- Improved responsive admin table handling on smaller screens.

## Testing notes

- Payment is not live. It is still interface/testing mode only.
- Migration actions are enabled for testing so the app can be reviewed end-to-end before live payment gating is connected.
- Delete the old project folder before extracting this ZIP to avoid stale UI files remaining in place.
