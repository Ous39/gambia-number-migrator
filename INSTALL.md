# Install Guide

## Windows setup

1. Install Node.js 20 LTS or newer.
2. Install Docker Desktop.
3. Install pnpm:

```powershell
npm install -g pnpm
```

4. Extract the project to a folder. Paths with spaces are supported by the `.bat` scripts.
5. Double-click `RUN_THIS_FIRST.bat`.

## Manual setup

```bash
pnpm install
docker compose up -d
pnpm --filter @gnm/api db:migrate
pnpm --filter @gnm/api db:seed
```

## Ports

- API: `8089`
- Admin: `5173`
- PostgreSQL host port: `5434`
- Expo: default Expo port

## Environment files

Copy `.env.example` to `.env` for backend local development. Admin uses `VITE_API_BASE_URL`. Mobile uses `EXPO_PUBLIC_API_BASE_URL`.
