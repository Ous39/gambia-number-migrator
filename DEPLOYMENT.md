# Deployment

## Production prerequisites

- Ubuntu VPS with Docker, Docker Compose, Nginx and valid TLS
- Production PostgreSQL backup
- DNS for `api.oceanbrown.gm`, the Admin hostname and `gnm.oceanbrown.gm`
- Production `.env` with unique secrets
- Working public Privacy, Terms and Support pages (served by `apps/web`)

## Host reverse proxy

`docker-compose.production.yml` binds the API, Admin and Website containers to `127.0.0.1` only, so a host-level Nginx (outside Docker) is the sole public entry point. `deploy/nginx-host-reverse-proxy.example.conf` is a ready-to-adapt vhost trio for `api.oceanbrown.gm`, the Admin hostname and `gnm.oceanbrown.gm`: HTTP→HTTPS redirect, Certbot ACME challenge location, TLS, HSTS/security headers, proxy headers, request-size limits and timeouts. Copy it to `/etc/nginx/sites-available/`, adjust the domains and run `certbot --nginx` to provision certificates before enabling it.

## Required environment

Set at minimum:

```text
NODE_ENV=production
DATABASE_URL=postgres://...
JWT_SECRET=<random value of at least 32 characters>
PAYMENT_TEST_MODE=false
PAYMENT_PROVIDER_INTEGRATION_READY=false
CORS_ORIGIN=https://<admin-host>,https://gnm.oceanbrown.gm
ADMIN_BASE_URL=https://<admin-host>
EXPO_ACCESS_TOKEN=<optional push security token>
POSTGRES_PASSWORD=<unique database password>
VITE_API_BASE_URL=https://api.oceanbrown.gm/api
VITE_PLAY_STORE_URL=<Google Play listing URL, once published>
VITE_APP_STORE_URL=<App Store listing URL, once published>
```

Keep Wave and APS webhook secrets empty until signed approval, live credentials and verified callbacks are available. Remove `ADMIN_INITIAL_PASSWORD` after the one-time fresh-database bootstrap.

## Deploy safely

1. Back up PostgreSQL and verify the backup can be read. Uploaded team photos live in the `gnm_uploads` Docker volume (mounted at `/app/uploads` in the API container) — back that up too (`docker run --rm -v gnm_uploads:/data -v $(pwd):/backup alpine tar czf /backup/gnm_uploads.tar.gz -C /data .`).
2. Upload or pull this clean source release.
3. Install with the frozen lockfile.
4. Build and run migrations.
5. Rebuild containers and check logs.

```bash
pnpm install --frozen-lockfile
pnpm --filter @gnm/shared build
pnpm --filter @gnm/api db:migrate
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
curl https://api.oceanbrown.gm/api/health
```

The included production Compose stack binds the API, Admin and Website containers to localhost so the VPS reverse proxy remains the only public entry point. Do not run `db:seed` on every restart. Run it only once for a truly fresh database.

## Migration verification

Confirm migrations through `024_team_profiles.sql` appear in `schema_migrations`. Confirm:

- `devices.device_secret_hash` exists
- `payments.device_id` has `fk_payments_device`
- `free_access_mode` is `all`
- `subscription_price` is `25`
- `wave_payment_enabled` and `aps_payment_enabled` are `false`
- `website_announcements`, `website_faqs`, `website_team_members` and `website_inquiries` exist
- `website_team_members.photo_url`, `.long_bio` and `.portfolio_url` exist

## Rollback

Do not edit applied migration files. If deployment fails, stop the new containers, restore the verified backup and start the previous application image/source release. Preserve logs and the failing migration name for diagnosis.
