# 10 — DevOps, CI/CD and Production Operations

## CI on pull requests

Run:

1. dependency install with frozen lockfile
2. lint/format check
3. TypeScript typecheck
4. unit tests + coverage
5. disposable Postgres/PostGIS + Redis integration tests
6. OpenAPI generation + drift check
7. web build
8. mobile Expo doctor/config validation + unit tests
9. Playwright web E2E
10. secret scan, SAST, dependency/IaC scan
11. build Docker API/web images where practical

Protect `main` and require these checks. Direct pushes to main should be blocked except approved break-glass procedure.

## Main/staging

After merge:

- repeat required gates
- build immutable versioned images
- sign/provenance if supported
- deploy staging
- run migrations via controlled job
- smoke + ZAP baseline + k6 smoke
- promote same image digest to production after approval/automated policy

## Deployment strategy

Use rolling or blue/green deployment with health checks. Database migrations must be backward-compatible with the prior application version whenever a rolling deployment is used (expand/contract pattern).

## Observability

Emit:

- structured JSON logs with trace ID
- HTTP latency/error metrics
- DB pool/query timing
- queue depth/failure metrics
- websocket connection/error metrics
- booking/dispatch state transition metrics
- provider dependency latency/error rate

Create alerting for auth spikes, elevated 5xx, payment webhook failure, dispatch queue age, queue dead letters, DB saturation and unusual upload/abuse patterns.

## Backup/DR

- automated encrypted DB backups + PITR
- object-storage versioning/lifecycle as appropriate
- quarterly restore test at minimum
- documented RPO/RTO based on business requirements

## Feature flags

Use server-evaluated flags for sensitive rollout. Do not rely on client-only flags for authorization. Property module, new dispatch provider and experimental reward behaviors should be separately controllable.
