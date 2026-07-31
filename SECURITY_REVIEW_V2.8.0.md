# Security Review v2.8.0

## Implemented

- Helmet headers, explicit CORS allow-list, 1 MiB JSON limit, global and login-specific rate limits.
- Bcrypt password storage, expiring JWT authentication, admin role/area checks, active-account verification, parameterized PostgreSQL queries, and Zod validation.
- Random request correlation IDs without exposing internals.
- Server-owned amount, currency, provider allow-list, entitlement activation, and production manual-confirmation denial.
- Device-scoped payment intent idempotency.
- Timestamped HMAC-SHA256 webhook verification over the raw request body.
- Unique provider event IDs, replay rejection, status allow-list, and transactional webhook persistence.
- No secrets, OTPs, contact lists, or provider payloads are written to application audit logs.

## Provider contract

Expected webhook headers are `x-webhook-id`, `x-webhook-timestamp` (Unix seconds), and `x-webhook-signature` (`sha256=<hex>` or `<hex>`). The signed value is `<timestamp>.<raw request body>`. Confirm this contract with each provider; adapt only from official documentation.

## Remaining

- Rotate/revoke JWTs for immediate logout if that is required operationally.
- Add CSRF tokens only if cookie authentication is introduced; current bearer-token API does not use auth cookies.
- Resolve reported dependency advisories through tested Expo/React Router/Vite upgrades.
- Conduct an external penetration test before national-scale launch.
