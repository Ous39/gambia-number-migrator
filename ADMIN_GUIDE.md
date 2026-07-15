# Admin Guide

Before publishing, confirm that every rule uses the operator's official two-digit migration prefix and that no equal-priority ranges overlap across operators. The API blocks ambiguous or demo-marked rule sets.

## Login

- URL: `http://localhost:5173`
- Username: `admin`
- Password: value of `ADMIN_INITIAL_PASSWORD` in your `.env`

Change the default seed password before production.

## Dashboard

The Dashboard shows rule totals, active operators, today’s payments, transition configuration, and recent audit activity.

## Operators

Use Operators to manage network/operator configuration. Each operator has:

- Name
- Code
- New prefix
- Color
- Status
- Notes

## Migration Rules

Rules control how 7-digit numbers become 9-digit numbers. Current sample rules are only for testing:

- QCell: old numbers starting with `3` or `5` → `83` + old number
- Comium: old numbers starting with `6` or `8` → `86` + old number
- Africell: old numbers starting with `2`, `4`, or `7` → `87` + old number

After editing rules, click **Publish Rules** so mobile devices can sync the latest published payload.

## Transition Settings

Use Transition Settings to control:

- Start date: `2026-09-04`
- End date: `2026-11-30`
- Default update mode
- Replace mode availability
- Banner and cleanup messages

## Payments

Payments use the secured development OTP flow when `PAYMENT_TEST_MODE=true`. Manual confirmation is available to administrators for controlled testing and must not replace provider settlement verification in production.

## App Config

App Config stores lightweight settings such as pricing, support contact, announcement message, and feature flags.

## Audit Logs

Admin actions such as login, operator/rule changes, rule publishing, transition updates, and payment confirmations are recorded in audit logs.

## Privacy rule

The admin panel must never receive or store a user’s full contact list. Contacts are scanned and updated locally on the phone only.
