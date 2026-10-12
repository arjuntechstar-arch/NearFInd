# 07 — Test Strategy and Quality Gates

## Test pyramid

### Unit

Target pure business logic: ranking/scoring, state transitions, validation, reward ledger rules, authorization policies, date/time logic, conversion and filtering.

### API integration

Run against real disposable PostgreSQL/PostGIS and Redis in CI. Test migrations, repositories, auth guards, spatial queries, transactions, idempotency and webhook replay protection.

### Contract

Generate OpenAPI from API; validate generated clients. Fail CI when API output and checked-in/generated client contract drift unexpectedly.

### Web

- component tests
- Playwright E2E on Chromium plus a representative Firefox/WebKit smoke set
- visual snapshots for key prototype-driven screens
- axe accessibility assertions on critical pages

### Mobile

- Jest + React Native Testing Library
- permission-denied/limited/offline unit/component scenarios
- Maestro or Detox critical flows on Android in CI/nightly; iOS on macOS release/nightly pipeline
- deep-link/push routing tests

### Realtime/multiplayer-style race conditions

Roadside dispatch/chat/booking need concurrency tests:

- two clients reserve same slot -> one succeeds, one receives conflict
- websocket disconnect/reconnect -> no unauthorized channel access and no duplicate state corruption
- duplicate client mutation retry -> idempotent result
- out-of-order events -> client reconciles to server version
- two moderators update same item -> optimistic-concurrency conflict

### Security

- dependency audit
- gitleaks
- Semgrep OWASP rules
- Trivy filesystem/image/IaC scan
- CodeQL in hosted CI where available
- ZAP baseline against staging/local web target
- authorization regression tests for IDOR/BOLA

### Performance

Use k6:

- nearby search
- service detail
- create contribution
- create booking (non-payment sandbox)
- dispatch status polling/realtime handshake where supported

Set thresholds and fail performance smoke on severe regression.

## Quality profiles

`Quick`: lint + typecheck + unit tests.

`Full`: Quick + integration + web E2E + build + security static scans + mobile validation.

`Release`: Full + image scans + staging smoke + k6 + optional ZAP + mobile E2E/release checks.

## Release gates

- all required tests green
- no critical/high unresolved security gate issue
- migrations tested forward; rollback/restore plan reviewed for destructive changes
- web accessibility critical violations = 0 on protected routes tested
- critical E2E flows pass
- build artifacts produced reproducibly

## Critical E2E scenarios

1. sign in -> permission decision -> explore -> filter -> service detail -> save
2. manual location when GPS denied
3. create contribution with photo -> moderation state visible
4. add vehicle -> book service -> sandbox payment authorization -> confirmation -> cancel policy
5. roadside request -> assignment simulation -> reconnect -> chat -> revoke live location -> resolve
6. receive/open alert and update preferences
7. offline open saved emergency information
8. reward earned via accepted contribution, not client spoof
9. property browsing/inspection when feature flag enabled
10. admin/moderator cannot access actions outside assigned permission
