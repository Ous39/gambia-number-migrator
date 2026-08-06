# GNM v2.8.1

Release date: 2026-08-03

## Mobile experience

- Reduced dashboard scrolling by consolidating repeated quick actions into one compact tools row.
- Kept the most important Scan and Preview actions immediately visible.
- Replaced the second privacy card with a concise assurance line.
- Removed hard-coded operator number examples from Migration Complete; the app now consistently depends on the verified rules published by Admin.
- Added a clearer post-migration safety message confirming local rule use and backup protection.

## Payments

- Removed the incorrect permanent "test checkout" label from APS.
- Payment messaging now follows `EXPO_PUBLIC_PAYMENT_TEST_MODE`.
- Test builds clearly state that no real charge is made.
- Production builds show privacy and payment-verification guidance without exposing test language.

## Release metadata

- Updated all workspace package versions to `2.8.1`.
- Updated Android `versionCode` to `29`.
- Updated iOS `buildNumber` to `29`.
- Updated the in-app version and API dashboard release value.

## Database

- No new database migration is required. Apply migrations `001` through `014`.
