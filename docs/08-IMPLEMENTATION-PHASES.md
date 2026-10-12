# 08 — Implementation Phases

## Phase 0 — Foundation

- monorepo, formatting/lint/typecheck/test standards
- Docker local stack: Postgres/PostGIS + Redis + local S3-compatible service
- API health/readiness and observability foundations
- OIDC integration skeleton
- shared design tokens and base component library
- OpenAPI generation/client pipeline
- GitHub Actions and PowerShell test scripts wired

**Exit:** empty but deployable shells; auth plumbing proven; CI green.

## Phase 1 — Core discovery MVP

- auth/onboarding
- profile/preferences/vehicles basic
- categories
- nearby list/map search + filters
- place detail
- favorites
- manual location fallback
- admin seed/provider management basics

**Exit:** user can discover, inspect and save real database-backed places on web/mobile.

## Phase 2 — Community + alerts + emergency essentials

- contributions/report updates + evidence uploads
- moderation workflow
- reviews/gallery
- notification center/preferences
- emergency contacts
- offline saved/emergency pack
- safety wording and region configuration

## Phase 3 — Routing and fuel intelligence

- route preview/provider abstraction
- navigation session UI/handoff
- fuel/EV observation freshness/confidence
- corridor search and optimizer scoring
- route-stop suggestions

## Phase 4 — Booking + payments

- provider schedules/slots
- booking state machine
- sandbox payment authorization
- confirmation/cancellation/receipts
- provider operations view
- concurrency/idempotency tests

## Phase 5 — Roadside dispatch + live chat

- request/triage/assignment state machine
- private roadside provider/dispatcher ops
- realtime status updates
- authenticated chat/media/voice note optional
- explicit live-location grant/expiry/revoke
- reconnect/concurrency/security tests

## Phase 6 — Rewards

- immutable points ledger
- challenges/perks/redemptions
- leaderboard privacy/fraud rules

## Phase 7 — Property module (feature flag)

- listings/search/detail
- nearby-service context
- inspection booking
- property operations moderation

## Phase 8 — Hardening/release

- complete threat-model review
- load/performance tuning
- accessibility audit
- disaster recovery/backup restore exercise
- production observability dashboards/alerts
- app-store/web release checklists
- privacy/retention configuration review
