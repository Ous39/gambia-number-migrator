# API Documentation

## Notifications

- `POST /api/notifications/register-token` registers an Expo push token for a known device.
- `GET /api/notifications?deviceId=...` returns published notifications for that device platform.
- `GET /api/admin/notifications` lists notification history (admin token required).
- `POST /api/admin/notifications` publishes and pushes a notification (admin token required).

Base URL: `http://localhost:8089/api`

## Auth

### POST `/auth/login`

```json
{ "username": "admin", "password": "<ADMIN_INITIAL_PASSWORD>" }
```

Returns JWT token.

### GET `/auth/me`

Requires `Authorization: Bearer <token>`.

## Public mobile endpoints

### GET `/migration-rules`

Returns latest published rules only.

### GET `/transition-settings`

Returns transition start/end dates and recommended messaging.

### GET `/app-config`

Returns public app configuration.

## Admin endpoints

- `GET /admin/dashboard`
- `GET /operators`
- `POST /operators`
- `PUT /operators/:id`
- `DELETE /operators/:id`
- `GET /admin/migration-rules`
- `POST /admin/migration-rules`
- `PUT /admin/migration-rules/:id`
- `DELETE /admin/migration-rules/:id`
- `POST /admin/migration-rules/test`
- `POST /admin/migration-rules/publish`
- `GET /admin/transition-settings`
- `PUT /admin/transition-settings`
- `GET /admin/payments`
- `POST /admin/payments/:id/confirm-manual`
- `GET /admin/audit-logs`

## Payment endpoints

### POST `/payments/create-intent`

```json
{
  "provider": "wave",
  "deviceId": "device-local-demo",
  "featureKey": "bulk_unlock",
  "amount": 50,
  "currency": "GMD",
  "metadata": {}
}
```

### GET `/payments/:reference/status`

Returns payment status.

### POST `/payments/webhook/wave`
### POST `/payments/webhook/aps`

Webhook endpoints for future provider integration.

## Health

### GET `/health`

Returns API and database health.

## Device / Unlock Endpoints

These endpoints support premium unlock and admin visibility without receiving contact data.

### POST `/api/devices/register`

Registers a privacy-safe device reference.

Request:

```json
{
  "fingerprint": "device-fingerprint",
  "deviceName": "Ousman's iPhone",
  "deviceModel": "iPhone",
  "osName": "iOS",
  "osVersion": "18",
  "platform": "ios"
}
```

Response:

```json
{
  "data": {
    "id": "device-fingerprint",
    "status": "trial",
    "trialContactsUsed": 0,
    "freeTrialLimit": 0,
    "subscriptionPrice": 50,
    "currency": "GMD"
  }
}
```

### GET `/api/devices/:fingerprint/status`

Returns the current device unlock/payment status.

### POST `/api/devices/:fingerprint/trial-increment`

Reserved for trial-count workflows. The default seed sets `free_trial_limit` to `0`, matching the product rule that free users can scan/preview but cannot bulk-update contacts.

### GET `/api/admin/devices`

Admin-only list of registered device references and statuses. No contacts are stored.

### POST `/api/admin/devices/:id/block`

Admin-only block action.

### POST `/api/admin/devices/:id/unblock`

Admin-only unblock action.
