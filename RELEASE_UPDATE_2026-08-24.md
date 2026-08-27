# Release update — persistent operations and controlled cleanup

## Included fixes

- Mobile LAN startup now uses one Expo networking option (`--lan`) and no longer combines LAN hosting with offline mode.
- Expo Go no longer eagerly loads remote push-notification APIs that were removed from Expo Go in SDK 53. Push notifications remain available in development/store builds.
- Scan results are saved and reused for the active published rules version. The dashboard opens the saved preview instead of scanning again.
- Scan, migration, backup, restore, and duplicate-cleanup status is persisted locally. A running or completed operation remains visible after navigating to another GNM screen and returning.
- Admin can enable or disable duplicate cleanup and optionally set opening and closing date-times.
- Duplicate cleanup remains backup-first and removes only the verified old number from an exact old/new pair. It rereads the contact to verify the new number remains and the old duplicate is gone.
- Successfully cleaned pairs are removed from the saved cleanup list without discarding the whole scan.
- Large mobile contact lists now use smaller render batches and Android clipping to reduce slow-list warnings and UI stalls.

## Important behavior

Operations continue when the user navigates between screens while GNM remains open. Android/iOS can suspend or stop JavaScript when an app is force-closed or kept in the background for a long time, so the app must remain open until a contact-writing operation finishes. Migration checkpoints remain recoverable through the existing migration job mechanism.

Duplicate cleanup is disabled by default. In Admin, open **App configuration**, enable **Allow verified duplicate cleanup**, optionally set the availability window, and save.

## Local mobile test

1. Run `RUN_THIS_FIRST.bat` once.
2. Run `START_ALL.bat`, or run `START_MOBILE.bat` for mobile only.
3. Keep the phone and computer on the same Wi-Fi or hotspot.
4. Scan the LAN QR code in Expo Go.
5. Use a development/store build to test remote push notifications; Expo Go can test the remaining features.
