# Store Privacy Declarations

This document is a submission checklist, not legal advice. Confirm the declarations against the final production build and provider contracts before submitting.

## Contacts permission

Purpose: scan, preview, back up, migrate and restore phone numbers requested by the user.

Processing: on device. Contact names and phonebook contents are not sent to the API by the application design.

## Notifications permission

Purpose: transition notices, migration reminders and administrator announcements. Permission is optional. A push token and privacy-safe device reference are sent to the service after consent.

## Data handled by the service

- Privacy-safe device reference: app functionality, payment entitlement and fraud prevention.
- Push notification token: app notifications.
- Payment reference, provider, amount, currency and status: payment processing and entitlement.
- Diagnostic/API logs: security, reliability and support, subject to the production retention policy.

## Data the app must not collect

- Contact names or full address-book contents
- Payment PINs
- Payment OTP codes beyond the provider-controlled verification flow
- Card numbers or wallet credentials
- Advertising identifiers for tracking

## Google Play Data safety draft

- Contacts: accessed for app functionality; processed on device; not collected by the backend.
- Device or other identifiers: collected for app functionality, fraud prevention and payment entitlement; not sold.
- App interactions/push token: collected for app functionality and notifications; not sold.
- Financial transaction information: collected when payment is enabled; used for purchase functionality and fraud prevention; not sold.
- Data encrypted in transit: Yes, when the required production HTTPS configuration is used.
- Data deletion: provide a public request method and document retention before submission.

## Apple App Privacy draft

- Identifiers — Device ID: linked to app entitlement only if the final implementation permits linkage; app functionality/fraud prevention.
- Purchases — Purchase history: app functionality.
- Contact Info — Phone number: only if the customer enters it for support or payment; app functionality.
- User Content — Contacts: on-device processing only and not collected.
- Diagnostics: declare only if production monitoring is enabled.
- Tracking: No, unless later advertising or cross-company tracking SDKs are introduced.

## Required public documents before release

- Privacy Policy
- Terms of Use
- Support page and working support email
- Payment and refund policy
- Data retention and deletion procedure
