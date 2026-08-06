# GNM v2.8.4 Startup and Splash Fix

## Corrected issues

- Replaced the undersized icon-only native splash with dedicated light and dark branded splash artwork.
- Made the complete **Gambia Number Migrator** name clearly visible on iOS and Android.
- Matched native splash backgrounds to the application light and dark themes.
- Replaced the generic in-app loading icon with the official GNM artwork.
- Added responsive name sizing so narrow iPhones and Android phones do not clip the title.
- Delayed native splash dismissal until React Native has committed its first full-size frame, preventing a blank flash.
- Limited startup configuration synchronization to 2.5 seconds so an offline or slow API cannot trap users on the loading page.
- Preserved cached/default migration data when the API is unavailable.

## Release identifiers

- Application version: `2.8.4`
- Android version code: `32`
- iOS build number: `32`

## Verification

- Mobile TypeScript check: passed
- Shared rule-engine tests: 9 passed
- Android production export: passed
- iOS production export: passed
- Web production export: passed

Physical-device launch checks should still be completed on at least one current iPhone and one current Android phone before store submission because native splash behavior is generated during the signed build process.
