# Privacy Data Flow v2.8.0

Contacts are read, scanned, previewed, backed up, migrated, verified, and restored on the device. Full contact books, contact names, and contact numbers are not sent to the GNM API.

The API receives a pseudonymous device reference, platform/model/OS/app version, push token when permission is granted, support activity time, trial/paid state, payment provider/reference/status/amount, and the customer payment number required for the selected provider. Server request infrastructure may observe an IP address.

Local backups are chunked, integrity-count checked, and excluded from backend transfer. Deleting local app data removes local scan/history/backup state. Server deletion requests require the support code so device, token, notification, and payment-retention obligations can be reviewed.

Push tokens are used only for notifications and should be disabled/removed when invalid. Payment secrets, PINs, OTPs, passwords, and full provider payloads must never be logged.
