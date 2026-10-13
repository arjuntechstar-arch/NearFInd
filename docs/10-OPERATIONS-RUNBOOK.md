# NearFind Operations Runbook

## Service health

- Liveness: `GET /v1/health`
- Readiness: `GET /v1/health/ready` verifies PostgreSQL connectivity.
- Metrics: `GET /v1/metrics` exposes process uptime and RSS in Prometheus text format.
- API logs must include request/trace IDs and must redact Authorization headers, cookies, payment tokens, PKCE values, OIDC codes and exact roadside coordinates.

Recommended production alerts:
- readiness failure > 2 minutes,
- API 5xx rate > 2% for 5 minutes,
- p95 API latency > 1.5 seconds for 10 minutes,
- PostgreSQL connection saturation > 80%,
- disk/object-storage capacity > 80%,
- booking/dispatch transaction rollback spike,
- security scanner or CodeQL high/critical finding,
- backup age beyond RPO.

## Deployment

1. Validate required environment variables from `.env.example` are present in the secret/config platform.
2. Run the full CI/security gate against the exact release commit.
3. Back up PostgreSQL before schema migration.
4. Apply migrations once using a dedicated migration job.
5. Deploy API, then web/mobile-compatible clients.
6. Verify liveness/readiness, smoke flows and error rate.
7. Enable high-risk feature flags gradually. The property module starts disabled.

Never run TypeORM `synchronize` in any environment.

## Rollback

Application rollback is preferred before schema rollback because migrations are additive wherever practical.

1. Disable newly introduced feature flags.
2. Roll the application image back to the last known-good commit.
3. Do not run destructive down migrations during an incident unless the database change itself is proven to be the cause and backups are verified.
4. If a data correction is required, use an audited forward-fix migration.

## PostgreSQL backup and restore

Production recommendation:
- encrypted daily logical/base backup,
- continuous WAL/PITR where supported,
- retention appropriate to legal/product requirements,
- quarterly restore exercise.

Restore exercise:
1. Provision isolated PostgreSQL/PostGIS with matching major versions.
2. Restore the selected backup/PITR point.
3. Run `SELECT PostGIS_Full_Version();` and schema/migration verification.
4. Execute API integration and representative spatial queries.
5. Record restore duration, data-loss window and issues.

Targets should be defined by the operator; a sensible initial objective is RPO <= 24 hours and RTO <= 4 hours, tightened once production usage justifies it.

## Object storage backup

- Bucket must remain private.
- Enable server-side encryption and versioning in production.
- Replicate or snapshot the media bucket according to provider capabilities.
- Database object keys and object storage are restored together to avoid dangling references.
- Run lifecycle jobs for rejected/abandoned temporary media after the applicable retention period.

## Redis failure

Redis is non-authoritative. If Redis is unavailable:
- durable bookings, dispatch, rewards and authorization continue to use PostgreSQL,
- cached data may be recomputed,
- queued noncritical work may be delayed/retried,
- never reconstruct financial or dispatch truth only from Redis.

## Identity-provider outage

- Existing API access tokens continue only until their natural expiry.
- New sign-in/refresh operations may fail.
- Do not bypass signature/issuer/audience checks.
- Display a controlled sign-in unavailable message; do not fall back to local passwords.

## Roadside incident handling

NearFind roadside assistance is private support, not government/public emergency dispatch.

- Keep the direct regional emergency-call option visible and separate.
- Dispatch start/live location is sensitive and encrypted.
- Live sharing is time-limited and revocable.
- Support/admin staff should access only requests required for their duties; access is auditable.
- If a location-data incident occurs, revoke active grants, rotate relevant secrets, preserve audit logs and follow the privacy incident process.

## Payment incident handling

NearFind APIs accept only opaque payment-method/provider references. PAN/CVV must never be requested or logged.

If payment authorization is inconsistent:
1. Stop new payment authorization via feature/traffic controls if needed.
2. Reconcile `payment_references` against provider records using idempotency/external references.
3. Never create a second charge merely because the client timed out.
4. Correct booking/payment state with an audited forward fix.

## Privacy requests

Export should include user-owned profile/preferences, vehicles, favorites, contributions, reviews, bookings, roadside request history, rewards ledger/redemptions and inspection bookings, excluding data belonging to other users/providers.

Deletion workflow:
1. Authenticate and re-verify the requester according to account policy.
2. Cancel active bookings/roadside grants where appropriate.
3. Remove/revoke user media that no longer has a legal/product retention basis.
4. Delete/anonymize personal data while retaining narrowly required accounting/security/audit records under documented legal retention rules.
5. Record completion without retaining the deleted sensitive content.

## Data retention baseline

- Route sessions: application expiry after 24 hours; schedule physical cleanup.
- Live-location grants: expire at TTL; schedule cleanup/anonymization of expired exact coordinates.
- Rejected/unattached upload objects: short lifecycle retention.
- Security/audit events: retain per operator compliance policy with restricted access.
- Payment references: retain only provider reference/status/amount metadata needed for reconciliation; no card data.

## Capacity and performance

Before production launch run load tests for:
- nearby discovery at representative urban densities,
- route-corridor optimization,
- slot contention/booking oversell prevention,
- roadside state/event reads,
- moderation/admin lists.

Track p50/p95/p99 latency, DB CPU, connection count, spatial-query plans and error rate. Add indexes only after validating query plans on production-like data.

## Accessibility operations

Release smoke testing covers keyboard navigation, visible focus, semantic labels, screen-reader names, contrast, reduced motion, mobile dynamic text, touch targets and error announcements. Accessibility regressions are release defects, not optional polish.
