# Changelog v2.8.0

- Completed OceanBrown navy/electric-blue admin branding and removed legacy purple UI tokens.
- Added Android `versionCode` 28 and iOS `buildNumber` 28 without changing package identifiers.
- Added request IDs to API responses.
- Added payment intent idempotency and database uniqueness.
- Replaced static webhook-secret comparison with signed timestamped HMAC verification.
- Added webhook replay-event persistence and transactional state/device activation.
- Kept generated OTP strictly inside payment test mode; production copy no longer claims GNM sends provider OTPs.
- Added migration `014_payment_idempotency_and_webhook_replay.sql`.
- Added v2.8.0 audit, security, privacy, accessibility, testing, deployment, notification, payment, backup, database, local-development, release, and third-party documentation.
