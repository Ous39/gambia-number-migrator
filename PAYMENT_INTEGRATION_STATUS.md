# Payment Integration Status

Wave and APS are the only supported provider names. GNM validates the configured server price, Gambian phone format, payment state, idempotency key, webhook signature/timestamp/event ID, and activates premium only from verified server processing.

Test mode provides a local four-digit code solely for development. Production does not generate or claim to send a provider OTP.

Live payment creation, provider checkout/redirect, official signature headers, expiry, refund, settlement, and reconciliation are incomplete until OceanBrown receives and tests official Wave and APS documentation, credentials, sandbox access, callback allow-list requirements, and production approval. No endpoint or behavior has been invented.
