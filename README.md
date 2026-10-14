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

## Quality gates

Run the same quick gate used by CI:

```powershell
./scripts/testing/Test-All.ps1 -Profile Quick -AllowMissingSecurityTools
```

The release branch also runs PostGIS-backed integration tests, Gitleaks, Semgrep, Trivy and CodeQL.

## Production configuration

Production requires real OIDC settings, database/Redis/S3 configuration, a 32-byte field-encryption key, and a self-hosted/commercial HTTPS Overpass-compatible endpoint for external nearby discovery. The shared public Overpass community host is intentionally rejected as a production dependency.
