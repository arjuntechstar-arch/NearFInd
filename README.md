# NearFind

NearFind is a web + mobile nearby-services platform for discovery, routing, community updates, bookings, roadside assistance, rewards and property discovery.

This repository uses a pnpm/Turborepo monorepo with:

- `apps/api` — NestJS + Fastify + PostgreSQL/PostGIS API
- `apps/web` — Next.js web client
- `apps/mobile` — Expo React Native client
- `packages/design-tokens` — shared design tokens
- `docs` — architecture, security, API and implementation guidance

## Local development

Requirements: Node.js 24+, pnpm 12.11.2+, Docker Desktop/Engine.

1. Copy `.env.example` to `.env` if you want to override defaults.
2. Run `pnpm setup:local`.
3. Run `pnpm dev`.
4. Open `http://localhost:3000`.
5. Tap **Use my location** to load NearFind + real-world nearby fuel/EV, ATM, hospital/clinic, bank, mechanic and pharmacy results.
6. Tap **Sign in** for the built-in local USER identity, or open `http://localhost:3000/dev-login` to switch between USER / PROVIDER / ADMIN test identities.

Local auth is development/test-only. Set `LOCAL_DEV_AUTH=false` when intentionally testing a real OIDC provider. Staging/production never accept the built-in local identities.

The API loads configuration from both `apps/api/.env` and the repository-root `.env`. Browser CORS defaults to `http://localhost:3000` through the validated application config.

For Expo on a physical phone, `localhost` points at the phone itself. Set `EXPO_PUBLIC_API_BASE_URL` to the development computer's LAN address, for example `http://192.168.1.20:4000/v1`.
Prerequisites: Node.js 24+, pnpm 12+, Docker Desktop/Engine with Compose.

1. Copy `.env.example` to `.env`. The default development values are usable locally; replace the example Overpass contact URL with your own identifier if you use the public endpoint for manual testing.
2. Start dependencies with `docker compose up -d`.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Run migrations with `pnpm --filter @nearfind/api migration:run`.
5. Seed deterministic demo discovery data with `pnpm --filter @nearfind/api db:seed`.
6. Run `pnpm dev` from the repository root. This command loads the root `.env` once and passes it to the API, web and Expo workspaces.
7. Open `http://localhost:3000` and choose **Sign in**. In development, NearFind creates a local USER session without requiring an external OIDC provider.

### Local role testing

Development auth is available only when `NODE_ENV=development` and `DEV_AUTH_ENABLED=true`. Use these URLs to exercise server-owned role authorization from the web client:

- USER: `http://localhost:3000/auth/login?role=USER&next=/hub`
- PROVIDER: `http://localhost:3000/auth/login?role=PROVIDER&next=/hub`
- ADMIN: `http://localhost:3000/auth/login?role=ADMIN&next=/hub`

Staging and production reject development auth and require the configured OIDC issuer/JWKS settings.

### Mobile development

`pnpm dev` also exposes the root `EXPO_PUBLIC_*` settings to Expo. When the configured API URL uses `localhost`, the mobile client automatically replaces it with the Metro/LAN host on a physical device or `10.0.2.2` on an Android emulator. You can still explicitly set `EXPO_PUBLIC_API_BASE_URL` to a reachable LAN/API address when needed.

The mobile client uses the same development login endpoint when `EXPO_PUBLIC_DEV_AUTH_ENABLED=true`. Tokens are stored in Expo SecureStore.

## Real-world nearby discovery

Development can augment NearFind-owned records with OpenStreetMap/Overpass fuel/EV, ATM, hospital/clinic, bank, mechanic and pharmacy locations. External failures degrade to cached/NearFind records instead of taking discovery down. Production must use a suitable self-hosted or commercial Overpass-compatible endpoint rather than the shared public community host.

## Quality gates

Run the same quick gate used by CI:

```powershell
./scripts/testing/Test-All.ps1 -Profile Quick -AllowMissingSecurityTools
```

The release branch also runs PostGIS-backed integration tests, Gitleaks, Semgrep, Trivy and CodeQL.

## Production configuration

Production requires real OIDC settings, database/Redis/S3 configuration, a 32-byte field-encryption key, and a self-hosted/commercial HTTPS Overpass-compatible endpoint for external nearby discovery. The shared public Overpass community host is intentionally rejected as a production dependency.
## Runtime verification

The API integration suite includes a development-runtime authentication regression covering USER, PROVIDER and ADMIN login followed by authenticated `/v1/me` access. Web/mobile static regressions verify live location paging, local sign-in wiring, external attribution and mobile API-host resolution.
