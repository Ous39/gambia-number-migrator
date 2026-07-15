# Run Instructions

The migration command now records completed SQL files in `schema_migrations`; it is safe to run again and only unapplied migrations will execute.

## First run

```bash
pnpm install
pnpm --filter @gnm/shared build
docker compose up -d
pnpm --filter @gnm/api db:migrate
pnpm --filter @gnm/api db:seed
```

## Start API

```bash
pnpm --filter @gnm/api dev
```

Open `http://localhost:8089/api/health`.

## Start Admin

```bash
pnpm --filter @gnm/admin dev
```

Open `http://localhost:5173`.

## Start Mobile

```bash
pnpm --filter @gnm/mobile start
```

Scan the Expo QR code.

## Troubleshooting

- If PostgreSQL fails, run `docker compose ps` and confirm the database container is healthy.
- If port `8089` is busy, stop the other process or update `.env` and scripts.
- If mobile cannot reach API on a physical phone, replace `localhost` with your PC LAN IP in `EXPO_PUBLIC_API_BASE_URL`.
- If admin cannot login, run database migration and seed again.

## Fix: mobile shows Network request failed
This means the phone cannot reach the API. Use these checks:

1. API must be running on port 8089.
2. Phone and PC must be on the same network or hotspot.
3. Do not use `localhost` from a physical phone. Use your PC IP, for example:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://YOUR_PC_IP:8089/api"
npx expo start --clear --port 8082
```

The updated app tries to auto-detect the Expo LAN IP and use `http://LAN_IP:8089/api` when the env value is still localhost.
