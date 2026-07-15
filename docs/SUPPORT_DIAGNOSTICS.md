# Support diagnostics

Version 1.9.4 provides a limited diagnostic record to resolve payment and access problems.

The server stores the app-generated device reference, support code, device model/name, platform, operating-system version, app version, access status, trial usage, last active time and last-seen IP address. Payment records already stored by the payment service can be viewed beside the device record by an authenticated administrator.

The diagnostic system does not upload contact names, contact phone numbers, phonebook contents, migration candidates or backups. Users can see and share their support code from Settings. Administrators should use diagnostic data only for user-requested support, payment recovery and fraud prevention.

Paid access can be restored only when the server finds a successful payment for the same device. Every restoration is written to the audit log.
