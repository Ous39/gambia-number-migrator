# Gambia Number Migrator Run Guide

This project is a monorepo with:

- `apps/mobile` — Expo React Native mobile app
- `apps/admin` — React/Vite admin panel
- `apps/api` — Node.js/Express API
- `packages/shared` — shared phone/rules/migration logic
- `database` — PostgreSQL migrations and seed data

## First setup on Windows

1. Install Node.js LTS.
2. Install pnpm if needed:

```bat
npm install -g pnpm
```

3. Open Docker Desktop.
4. Double-click:

```bat
RUN_THIS_FIRST.bat
```

This installs dependencies, builds the shared package, starts PostgreSQL on port `5434`, runs migrations, and seeds sample operators/rules.

## Start everything

Double-click:

```bat
START_ALL.bat
```

Default ports:

- API: `http://localhost:8089/api/health`
- Admin: `http://localhost:5173`
- Expo mobile: `8082`
- PostgreSQL: `5434`

The mobile BAT file auto-detects your PC LAN IP and sets:

```bat
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:8089/api
```

This is important because a real phone running Expo Go cannot call your PC API through `localhost`.

## Start manually

```bat
pnpm install
pnpm --filter @gnm/shared build
docker compose up -d
pnpm --filter @gnm/api db:migrate
pnpm --filter @gnm/api db:seed
pnpm --filter @gnm/api dev
pnpm --filter @gnm/admin dev
pnpm --filter @gnm/mobile start -- --host lan --port 8082 --clear
```

## Admin login

- URL: `http://localhost:5173`
- Username: `admin`
- Password: `admin12345`

Change the seed password before production.

## Troubleshooting

Run this if ports are busy:

```bat
FIX_PORTS.bat
```

Run this if Expo says port `8081` is busy:

```bat
START_MOBILE.bat
```

The project uses Expo port `8082` by default.

## PostgreSQL connection fix

If the API window shows `ECONNREFUSED 127.0.0.1:5434` or `ECONNREFUSED ::1:5434`, PostgreSQL is not reachable.

Use this order:

1. Open Docker Desktop.
2. Run `RUN_THIS_FIRST.bat` once.
3. Run `START_ALL.bat`.
4. Check `http://localhost:8089/api/health`.

The API public mobile routes can return fallback config while the database is down, but admin login needs PostgreSQL.

## Docker Desktop startup check

Before running Admin login or database migrations, open Docker Desktop and wait until it says Docker is running.

The updated BAT files now check Docker safely:

- If Docker is missing, the script warns you.
- If Docker Desktop is installed but closed, the script warns you and skips migrations.
- If PostgreSQL is not ready on port 5434, the script skips migrations instead of producing repeated `ECONNREFUSED` errors.

Admin login requires PostgreSQL. The mobile app can still use fallback test rules if the database is down.
