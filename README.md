# NearFind

NearFind is a web + mobile nearby-services platform for discovery, routing, community updates, bookings, roadside assistance, rewards and property discovery.

This repository uses a pnpm/Turborepo monorepo with:

- `apps/api` — NestJS + Fastify + PostgreSQL/PostGIS API
- `apps/web` — Next.js web client
- `apps/mobile` — Expo React Native client
- `packages/design-tokens` — shared design tokens
- `docs` — architecture, security, API and implementation guidance

## Local development

1. Copy `.env.example` to `.env` and configure local values.
2. Start dependencies with `docker compose up -d`.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Run migrations with `pnpm --filter @nearfind/api migration:run`.
5. Seed deterministic demo discovery data with `pnpm --filter @nearfind/api db:seed`.
6. Run `pnpm dev`.

## Quality gates

Run the same quick gate used by CI:

```powershell
./scripts/testing/Test-All.ps1 -Profile Quick -AllowMissingSecurityTools
```

The release branch also runs PostGIS-backed integration tests, Gitleaks, Semgrep, Trivy and CodeQL.

## Implementation status

The active consolidated pull request implements the complete Phase 0–8 roadmap from `docs/08-IMPLEMENTATION-PHASES.md`. Earlier stacked identity/client-auth pull requests are superseded by that single PR and must not be merged independently.
