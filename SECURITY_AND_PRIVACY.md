# Security and Privacy

## Contact privacy

- Contacts are processed on device.
- Contact names and full phone books are not uploaded.
- Backups are local to the device.
- Scan results are local.
- Payment backend receives no contact data.

## Backend data handling

The backend stores only admins, operators, migration rules, published rule versions, transition settings, app config, payments, and audit logs.

## Production recommendations

- Change default admin password.
- Use a strong `JWT_SECRET`.
- Use HTTPS.
- Restrict admin panel to trusted networks if required.
- Configure CORS to exact production domains.
- Store payment provider secrets in environment variables.
- Review audit logs regularly.
- Replace sample/demo operator rules with official published rules through the admin panel.
- Run database backups.

## Rule safety

The mobile app must not guess unknown numbers. Unknown or low-confidence numbers are Manual Review.

## Destructive actions

Replace Mode and Remove Old Duplicates require user confirmation and a local backup.

## Logic Merge Privacy Note

The device registration and premium unlock logic uses only a privacy-safe device reference plus optional device metadata such as platform/model. It never sends contact names, phone numbers, scan results, or phonebook content to the backend. Contact scanning, update, cleanup, backups, and restore remain local-only on the mobile device.
