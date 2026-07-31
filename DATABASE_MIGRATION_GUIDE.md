# Database Migration Guide

Migrations are ordered, checksum-by-source controlled operationally, and each file runs in a transaction before its filename is recorded. v2.8.0 adds migration 014 for payment idempotency and webhook replay events.

Before production: take and test a database backup, clone production into staging with sensitive data protected, run `pnpm db:migrate`, inspect constraints/indexes, run API integration tests, and monitor lock time. This project has no automatic down migrations; rollback is database snapshot restoration plus the previous application release.
