# Store Release

## Release identity

- Store display name: **GNM**
- Public version: **1.0.0**
- Android application ID: `gm.oceanbrown.gnm`
- iOS bundle ID: `gm.oceanbrown.gnm`
- Production API: `https://api.oceanbrown.gm/api`

Do not change the application ID or bundle ID after creating the store records.

## Build commands

From `apps/mobile`:

```bash
eas login
eas project:info
eas build --platform android --profile production
eas build --platform ios --profile production
```

Production builds use the `store` distribution channel, the GNM store name and automatic build-number increments.

## Free-launch rules

- Campaign mode must be **Free for everyone**.
- Wave and APS must remain disabled in store builds.
- No unfinished purchase or “setup pending” UI may appear.
- Users must see Free Launch Access and receive full server-confirmed campaign access.
- Local Wave/APS payment testing is limited to direct development/preview builds.

## Google Play Console

Complete the app record, main store listing, icon, feature graphic, phone screenshots, support contact, privacy-policy URL, Data Safety, content rating, target audience, ads declaration, app access and Contacts/Notifications permission declarations. Upload the signed AAB to Internal Testing first and test the install/update path before production.

## App Store Connect

Complete the app record, name, subtitle, description, keywords, support URL, privacy-policy URL, screenshots, age rating, App Privacy, export compliance and review contact/details. Upload to TestFlight first. Explain in Review Notes that contact processing is local and the launch campaign is free.

## Final release gate

- API and database health connected
- Official rules reverified and published
- Privacy, Terms and Support URLs return HTTPS 200
- Android internal build tested on a physical device
- iOS TestFlight build tested on a physical device
- Backup, migration, cleanup and restore verified
- Notifications tested in native builds
- No placeholder copy, test OTP, Wave or APS checkout in store builds
- Store screenshots match the submitted build
- Monitoring and rollback owner available during launch

Store review timing is controlled by Apple and Google; reaching Internal Testing/TestFlight is not the same as public approval.
