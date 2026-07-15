# Production deployment

## Recommended first host: Railway

Railway is the simplest fit for this monorepo because the API, admin site and managed PostgreSQL can live in one project. Use a paid production plan; do not run production payment data on a free/sleeping service.

### 1. Create the infrastructure

1. Push this project to a private GitHub repository.
2. In Railway, create a project and add PostgreSQL.
3. Add an API service from the repository. Set the Dockerfile path to `Dockerfile.api` and health-check path to `/api/health`.
4. Add an admin service from the same repository. Set the Dockerfile path to `Dockerfile.admin` and build argument `VITE_API_BASE_URL=https://YOUR-API-DOMAIN/api`.
5. Give both services custom HTTPS domains, for example `api.example.com` and `admin.example.com`.

### 2. API production variables

Set these in the API service. Never place secrets in the mobile app or commit them.

```env
NODE_ENV=production
API_PORT=8089
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<at-least-32-random-characters>
ADMIN_INITIAL_PASSWORD=<unique-strong-password>
PAYMENT_TEST_MODE=false
CORS_ORIGIN=https://admin.example.com
ADMIN_BASE_URL=https://admin.example.com
WAVE_API_KEY=<issued-by-wave>
WAVE_WEBHOOK_SECRET=<issued-or-generated-for-wave-webhooks>
APS_MERCHANT_ID=<issued-by-aps>
APS_API_KEY=<issued-by-aps>
APS_API_BASE_URL=<official-aps-url>
APS_WEBHOOK_SECRET=<issued-or-generated-for-aps-webhooks>
```

The API container runs database migrations and idempotent bootstrap seeding before each start. `ADMIN_INITIAL_PASSWORD` creates the first owner on a new database but does not reset an existing owner's password during later deployments. PostgreSQL backups must also be enabled in the hosting account and a restore drill should be performed before launch.

Migration `012` installs the PURA Phase 1 operator allocation and the team-role constraints. Migration `013` publishes that verified ruleset automatically, so mobile devices receive it after refreshing. The initial `admin` account becomes the system `owner`.

After the first deployment, sign in as the owner and open **Team Access**. Create a separate named account for every person; never share the owner login. Available roles are owner, admin, operations, finance, support and viewer. Disabled accounts are rejected immediately even if an old login token still exists.

### 3. Mobile production build

Replace every `your-domain.gm` placeholder in `apps/mobile/eas.json`, set the EAS project ID, support contacts, privacy URL and terms URL, then run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

Upload first to Play internal testing and TestFlight. Test install, contact permission denial, 10,000-contact scanning, backup/restore, purchase/restore, offline errors, support code, notifications and account/device recovery before requesting review.

### 4. Store submission

Use `eas submit --platform android --profile production` and `eas submit --platform ios --profile production` only after the store product and server receipt validation are live. Store acceptance cannot be guaranteed by code: Apple and Google also review the listing, privacy declarations, screenshots, reviewer access, policies and behavior.
