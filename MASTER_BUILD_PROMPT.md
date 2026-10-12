# MASTER BUILD PROMPT — SpotNear Web + Mobile + API

You are the principal software engineer responsible for turning the attached prototype references into a secure, production-grade application. Build a **responsive web application**, **iOS/Android mobile application**, and **backend platform** for SpotNear.

## 0. Mandatory reading order

Before writing code:

1. Read this file completely.
2. Read all files in `docs/` in numeric order.
3. Inspect `prototype_reference/design/DESIGN.md`.
4. Inspect every screenshot under `prototype_reference/screens/` and the matching HTML under `prototype_reference/html/`.
5. Create a traceability checklist that maps every prototype screen to routes, components, API/data needs, and tests.

Do not start implementation until the traceability checklist exists.

## 1. Product intent

SpotNear is a location-aware nearby-services and driver-assistance platform. It helps users find trusted fuel/EV stations, ATMs, hospitals, banks, mechanics/towing, pharmacies and other useful places; compare route/fuel options; save places; report real-world service status; receive alerts; book services; request roadside help; chat with dispatch; manage vehicles and emergency contacts; earn community rewards; and optionally browse property listings.

The prototype is the visual and interaction reference, but it is not production code. Re-create its product language with reusable components; do not paste prototype HTML into the app.

## 2. Required architecture

Create a monorepo with this minimum structure:

```text
apps/
  web/                 # Next.js responsive web app
  mobile/              # Expo React Native iOS/Android app
  api/                 # NestJS API + WebSocket gateway
packages/
  design-tokens/       # shared semantic tokens
  api-client/          # generated OpenAPI client + typed wrappers
  domain/              # shared pure types/constants where safe
  config/              # ESLint/TS/Prettier shared config
  test-utils/          # factories, fixtures and helpers
infra/
  docker/
  terraform/
tests/
  e2e/
  contract/
  performance/
  security/
scripts/
  testing/
docs/
```

Use pnpm workspaces and Turborepo. All production code is TypeScript with `strict: true`. No `any` without a narrowly documented reason. Backend is NestJS with Fastify, PostgreSQL/PostGIS, TypeORM migrations, Redis/BullMQ, S3-compatible object storage, OpenAPI, and WebSockets. Use a provider abstraction for maps/routing/geocoding; implement Mapbox first without leaking provider-specific types into domain modules.

## 3. Role model

Implement RBAC/ABAC policies for:

- Guest
- Driver/User
- Scout/Contributor
- Service Provider Staff
- Dispatcher/Support Agent
- Moderator
- Administrator

Do not authorize only in the UI. Every protected operation must be enforced server-side and covered by tests.

## 4. Implementation principles

- Domain-oriented modular architecture; avoid giant “services” or “utils” folders.
- API contracts are explicit and versioned under `/v1`.
- Generate frontend/mobile API client from OpenAPI during CI and fail on contract drift.
- Use idempotency keys for booking/payment/dispatch creation and other retry-prone mutations.
- Use UTC in persistence; convert only at presentation boundaries.
- Use UUID/ULID identifiers; never expose sequential database IDs.
- Use database transactions for state transitions involving multiple writes.
- Use geospatial indexes for proximity/radius queries.
- Enforce pagination and server-side filtering; never return unbounded lists.
- Use feature flags for high-risk/optional modules, especially property listings and real emergency integrations.
- No production secrets in source, `.env` files committed to git, client bundles or mobile binaries.
- No placeholder pages, fake APIs or permanent hardcoded example data. Seed data is allowed only in local/test environments.

## 5. Design fidelity and accessibility

Follow the prototype’s Candy/Joyful Pop system:

- primary `#e040a0`
- secondary `#7c52aa`
- tertiary `#0096cc`
- background `#fef7ff`
- DM Sans typography
- pill controls; 16–20px cards; generous spacing; tinted shadows
- playful, short microinteractions

Create semantic design tokens rather than scattering hex values. Support light mode first and prepare token slots for dark mode. Respect `prefers-reduced-motion` and mobile reduced-motion settings. Meet WCAG 2.2 AA for web and equivalent mobile accessibility expectations. Do not repeat the prototype’s injected CSS that removes focus outlines globally; visible focus states are mandatory.

The prototype is mobile-first. Do not simply stretch mobile screens on desktop. Follow `docs/09-UI-RESPONSIVE-SPEC.md` for web adaptations.

## 6. Authentication and onboarding

The supplied auth prototype bodies are blank. Design auth screens using the same visual language and implement:

- email or phone sign-in through the chosen OIDC provider
- social sign-in where configured
- MFA/passkey support if provider supports it
- consent for location, notifications and analytics as separate permissions
- onboarding preferences: preferred service categories, fuel/EV type, optional vehicle, emergency-contact setup
- progressive permission prompts: never request all OS permissions on first launch
- account deletion/export and session management

Never implement password storage yourself if an external IdP is used.

## 7. Core product flows

Implement every flow in `docs/03-FUNCTIONAL-REQUIREMENTS.md`. At minimum, production MVP includes:

1. Explore nearby services with list/map modes, filters and search.
2. Category browser.
3. Service details, operating status, amenities, live data, reviews, media, save/share/call/route actions.
4. Favorites and offline emergency essentials.
5. Community report/contribution with moderation and anti-abuse protections.
6. User profile, vehicles, emergency contacts, privacy and data controls.
7. Notifications and alert preferences.
8. Map route preview and navigation handoff/in-app guidance abstraction.
9. Fuel/EV price comparison and route optimization.
10. Booking and payment authorization for supported service providers.
11. Roadside support request, dispatch state machine and live chat.
12. Reviews/photos and rewards.
13. Property listings/inspection booking behind a feature flag.

## 8. Emergency and dispatch safety rule

The prototype contains 911/police/ambulance concepts. Do not imply that SpotNear directly dispatches public emergency services unless a legally contracted, technically verified integration exists for the deployment region. Without that integration:

- emergency buttons must clearly call or deep-link to the region’s emergency number;
- roadside-dispatch features must be labeled as private roadside assistance;
- never show a fabricated police officer/unit as if officially dispatched;
- live-location sharing must be explicit, revocable and time-limited;
- display safety guidance without presenting the app as a substitute for emergency services.

## 9. Security baseline

Implement the requirements in `docs/05-SECURITY-PRIVACY.md` and use these baselines:

- OWASP ASVS Level 2 for web/API
- OWASP API Security Top 10
- OWASP MASVS for mobile
- secure-by-default headers/CSP/HSTS
- rate limiting + abuse throttling
- input validation at every trust boundary
- malware/file-type/size checks for uploads, EXIF privacy handling
- token storage in iOS Keychain / Android Keystore-compatible secure storage
- least-privilege cloud IAM and database credentials
- audit logs for privileged/financial/dispatch/moderation actions
- secrets scanning, SAST and dependency/container scanning in CI

Resolve critical/high exploitable findings before release. Do not suppress scanners just to make CI green.

## 10. Testing is part of implementation

Use `docs/07-TEST-STRATEGY.md`. Every feature requires tests in the same change. The supplied PowerShell scripts are the canonical local quality gates. Maintain them as the repository evolves.

Required coverage includes:

- domain unit tests
- API integration tests with real Postgres/PostGIS and Redis test services
- OpenAPI contract tests
- web component tests and Playwright E2E
- mobile unit/component tests and Maestro/Detox-style critical-flow E2E
- WebSocket reconnect/order/authorization tests
- location/map edge cases, denied permissions and offline mode
- accessibility tests
- visual regression for prototype-critical screens
- security tests/scans
- k6 performance smoke/load tests

## 11. State machines that must be explicit

Model and test state transitions; do not use arbitrary free-text statuses.

**Booking:** `draft -> awaiting_payment -> confirmed -> checked_in -> in_service -> completed`, with `cancelled` and `no_show` paths.

**Roadside dispatch:** `requested -> triaged -> provider_assigned -> en_route -> arrived -> assisting -> resolved`, with `cancelled`, `unable_to_assign` and `expired` paths.

**Contribution/report:** `submitted -> automated_screening -> pending_review -> accepted|rejected|needs_more_evidence`.

**Property inspection:** `requested -> confirmed -> completed`, with reschedule/cancel paths.

## 12. Performance targets

- p95 read API latency < 400 ms under normal regional load, excluding third-party routing latency
- p95 mutation API latency < 700 ms excluding third-party payment/dispatch calls
- initial web LCP target <= 2.5 s on representative mid-tier mobile network profile
- map viewport results use bounding-box/geospatial queries and clustering; never render thousands of raw pins
- mobile should remain usable on flaky/slow networks with request cancellation, retries with jitter, and offline cache for saved/emergency content

Measure; do not claim targets are met without test output.

## 13. Delivery phases

Follow `docs/08-IMPLEMENTATION-PHASES.md`. At the end of each phase:

1. update migration/schema docs;
2. update OpenAPI and generated clients;
3. add/refresh automated tests;
4. run `pwsh ./scripts/testing/Test-All.ps1 -Profile Full`;
5. summarize exactly what is complete, what is intentionally deferred, and any known risk.

Do not start the next phase while the current phase has failing tests.

## 14. Definition of Done

A feature is done only when:

- UX matches the intended prototype/responsive spec;
- real API/data path works;
- authorization and validation are enforced;
- loading/empty/error/offline states exist;
- observability exists for critical failures;
- unit/integration/E2E tests cover happy + negative paths;
- accessibility has been checked;
- docs and OpenAPI are updated;
- no critical/high unresolved security issue is introduced;
- CI passes.

Build for maintainability and safe operation, not just demo appearance.
