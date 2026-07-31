# Local Development Guide

1. Install Node 20 LTS, pnpm 9.12.3, Docker, and Git.
2. Copy `.env.example` to `.env`; never commit it.
3. Run `pnpm install --frozen-lockfile`.
4. Start PostgreSQL with `docker compose up -d postgres`.
5. Run `pnpm db:migrate` and `pnpm db:seed`.
6. Start API: `pnpm --filter @gnm/api dev`.
7. Start Admin: `pnpm --filter @gnm/admin dev`.
8. Set mobile `EXPO_PUBLIC_API_BASE_URL` to the PC LAN address, then run `pnpm --filter @gnm/mobile start`.

Validation: `pnpm typecheck`, `pnpm test`, and `pnpm build`.
