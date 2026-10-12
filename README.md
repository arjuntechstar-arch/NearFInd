# SpotNear — Production Web + Mobile Build Pack

This package converts the supplied Stitch prototype into an implementation-ready, production-grade blueprint for a **responsive web app + iOS/Android mobile app + backend platform**.

## What was inferred from the prototype

The product is a location-aware driver/nearby-services platform branded **SpotNear**. The supplied screens cover:

- nearby service discovery and map browsing
- categories and smart filters
- service/provider details and routing
- turn-by-turn route HUD concepts
- saved places and emergency hub
- roadside SOS/dispatch and live support chat
- community reporting, live fuel/ATM status and crowdsourced data
- ratings, reviews and community photos
- fuel-price comparison and route optimization
- service-bay booking and payment authorization
- rewards/XP/leaderboards
- vehicle/profile/privacy settings
- driver alerts/notifications
- real-estate/land listings and inspection booking

The design system is **Candy — “Joyful Pop”**: DM Sans, hot-pink primary, purple secondary, sky-blue tertiary, warm near-white background, pill-shaped controls, large rounded cards, tinted shadows, and playful motion.

> Note: the supplied `sign_in_welcome` and `sign_up_preferences` HTML bodies are empty. This pack therefore specifies production auth/onboarding screens that extend the visual system consistently.

## Recommended implementation stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Web:** Next.js 15+, React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form + Zod
- **Mobile:** React Native + Expo development builds, TypeScript, Expo Router, TanStack Query, NativeWind/tokens
- **API:** NestJS + Fastify adapter, TypeScript, REST/OpenAPI, WebSocket gateway
- **Database:** PostgreSQL + PostGIS, TypeORM migrations
- **Cache/queues:** Redis + BullMQ
- **Object media:** S3-compatible storage + signed URLs + CDN
- **Maps/routing:** provider abstraction; Mapbox implementation first
- **Auth:** OIDC/OAuth 2.1 with PKCE through a managed or self-hosted IdP; short-lived access tokens and rotated refresh tokens
- **Observability:** OpenTelemetry, structured logs, Sentry-compatible error reporting, Prometheus metrics
- **Deployment:** Docker; AWS example using ECS/Fargate, RDS Postgres/PostGIS, ElastiCache, S3/CloudFront, WAF, Secrets Manager

## How to use this pack with a coding agent

1. Give the entire ZIP to the coding agent.
2. Tell it to read `MASTER_BUILD_PROMPT.md` **first**, then every file under `docs/` and `prototype_reference/design/`.
3. Require it to implement phases in order and to pass the supplied PowerShell quality gates before moving to the next phase.
4. Do **not** let the agent replace functional requirements with placeholders, mocked production flows, or “TODO” stubs.

## Important files

- `MASTER_BUILD_PROMPT.md` — master build instruction
- `docs/01-PROTOTYPE-ANALYSIS.md` — screen inventory and responsive interpretation
- `docs/02-ARCHITECTURE.md` — architecture and runtime boundaries
- `docs/03-FUNCTIONAL-REQUIREMENTS.md` — user stories and acceptance criteria
- `docs/04-DATA-AND-API.md` — core data model and API design
- `docs/05-SECURITY-PRIVACY.md` — security, privacy and emergency-safety requirements
- `docs/06-CODING-STANDARDS.md` — code organization and engineering rules
- `docs/07-TEST-STRATEGY.md` — required test pyramid and release gates
- `docs/08-IMPLEMENTATION-PHASES.md` — phased delivery plan
- `docs/09-UI-RESPONSIVE-SPEC.md` — web/mobile design interpretation
- `docs/10-DEVOPS-OPERATIONS.md` — CI/CD, environments, observability and rollback
- `scripts/testing/*.ps1` — local/CI PowerShell test runners
- `.github/workflows/*.yml` — CI examples
- `prototype_reference/` — normalized screenshots, HTML and design reference

## Core release rule

A phase is not complete until the feature works end-to-end, negative cases are tested, relevant security checks pass, accessibility regressions are addressed, and `scripts/testing/Test-All.ps1 -Profile Full` passes.
