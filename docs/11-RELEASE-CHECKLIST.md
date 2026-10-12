# NearFind Release Checklist

Use this checklist for every production release. A checked item means evidence exists for the exact release commit.

## 1. Source and review

- [ ] Release commit is the exact head of the approved pull request.
- [ ] No direct unreviewed commits were pushed to `main`.
- [ ] Database migrations are additive/forward-safe or have an explicitly reviewed rollback plan.
- [ ] No placeholder, TODO-only, mock-only or development bypass remains on a production execution path.
- [ ] Feature flags have an owner, default state and rollback purpose.

## 2. Required automated gates

All must pass on the exact release head:

- [ ] pnpm frozen-lockfile install and supply-chain policy validation
- [ ] repository lint
- [ ] strict TypeScript typecheck
- [ ] unit/contract tests
- [ ] web/mobile build or export checks
- [ ] PostgreSQL/PostGIS migration run
- [ ] deterministic seed verification
- [ ] API integration/e2e tests
- [ ] Gitleaks
- [ ] Semgrep OWASP/TypeScript
- [ ] Trivy filesystem scan
- [ ] CodeQL

No high/critical security finding may be ignored without an explicit, time-bounded risk acceptance and owner.

## 3. Configuration and secrets

- [ ] `NODE_ENV=production`.
- [ ] Production `DATABASE_URL` points only to the intended database.
- [ ] OIDC issuer, audience and JWKS endpoint are production values.
- [ ] OIDC algorithm allowlist is asymmetric only.
- [ ] `FIELD_ENCRYPTION_KEY` is a secret-manager/KMS value and decodes to exactly 32 bytes.
- [ ] S3 endpoint uses HTTPS, private bucket, production access keys and server-side encryption.
- [ ] CORS contains only approved production origins.
- [ ] Web/mobile public client IDs and redirect URIs match the IdP allowlist.
- [ ] No client secret exists in web/mobile bundles.
- [ ] Emergency region/number are verified for the target market.

## 4. Backup, migration and restore readiness

- [ ] Fresh PostgreSQL backup/PITR checkpoint exists before migration.
- [ ] Backup age is inside the documented RPO.
- [ ] Object-storage backup/versioning is healthy.
- [ ] Migration executed successfully in staging from a production-like snapshot.
- [ ] `PostGIS_Full_Version()` and readiness checks pass after migration.
- [ ] Last restore exercise is current and recorded.
- [ ] Application rollback image/commit is known before deployment.

## 5. Authentication and authorization smoke tests

- [ ] Web Authorization Code + PKCE sign-in succeeds.
- [ ] Web bearer token remains server-side/HttpOnly and does not appear in browser storage.
- [ ] Mobile Authorization Code + PKCE sign-in succeeds.
- [ ] Mobile tokens are stored only in SecureStore.
- [ ] Sign-out clears local session state.
- [ ] USER cannot access PROVIDER/ADMIN APIs.
- [ ] Provider cannot modify another provider's resources.
- [ ] User cannot read another user's favorites, bookings, dispatches, inspections or contacts.
- [ ] JWT role claims cannot elevate the NearFind database role.

## 6. Discovery, community and media

- [ ] Foreground location is requested only after explicit user action.
- [ ] Manual location works when location permission is denied.
- [ ] Nearby PostGIS results and category filters are correct.
- [ ] Place detail/navigation handoff works.
- [ ] Contribution submission and admin moderation work.
- [ ] Review create/update and rating recalculation work.
- [ ] Notification read state works.
- [ ] Presigned media upload expires and cannot write outside the authenticated user/purpose prefix.
- [ ] Production malware/content scanning and EXIF stripping pipeline is enabled before public media publication.

## 7. Routing, fuel and EV

- [ ] Route optimizer returns candidates within the requested corridor.
- [ ] Fuel freshness/confidence is displayed and stale observations are not represented as live guarantees.
- [ ] EV connector ownership checks work.
- [ ] Navigation handoff uses the intended map provider.
- [ ] Route-session retention cleanup is active.

## 8. Booking and payments

- [ ] Concurrent reservation test cannot oversell a slot.
- [ ] Reservation hold expiry releases capacity.
- [ ] Duplicate booking idempotency key returns the same booking.
- [ ] Duplicate payment idempotency key never creates a second authorization.
- [ ] Only opaque payment/provider tokens are accepted; PAN/CVV is never requested/logged/stored.
- [ ] Cancel, complete and receipt flows match the state machine.
- [ ] Provider access is limited to its own bookings.

## 9. Roadside assistance and safety

- [ ] UI clearly separates direct public emergency calling from NearFind private roadside assistance.
- [ ] NearFind does not claim to dispatch government/public emergency services.
- [ ] Duplicate dispatch requests are idempotent.
- [ ] Admin triage/assignment and provider state transitions match the allowed state machine.
- [ ] Start location/notes are encrypted at rest.
- [ ] Exact live location requires an explicit TTL grant.
- [ ] Live-location revoke takes effect immediately.
- [ ] Dispatch chat is accessible only to requester, assigned provider and admin.
- [ ] Audit history records sensitive operational actions without logging location plaintext.

## 10. Rewards and property

- [ ] Reward balance is derived from immutable ledger entries.
- [ ] Duplicate challenge/award/redemption idempotency keys cannot double-credit/debit.
- [ ] Perk stock cannot go below zero under concurrency.
- [ ] Leaderboard exposes only opted-in users.
- [ ] Property module remains disabled by default on a new environment.
- [ ] Provider property ownership and admin moderation work.
- [ ] Published property edits return to moderation when appropriate.
- [ ] Inspection booking idempotency works.

## 11. Performance and resilience

- [ ] Production-like load test completed for discovery, route corridor, booking contention, dispatch event reads and admin queues.
- [ ] p95/p99 latency and error rate meet the release SLO agreed by the operator.
- [ ] Database connection pool stays below saturation under expected peak load.
- [ ] Spatial queries use expected indexes/plans on production-like volume.
- [ ] API body size/timeouts are enforced.
- [ ] Redis outage does not corrupt durable business state.
- [ ] IdP outage does not trigger an authentication bypass.

## 12. Accessibility and UX

- [ ] Keyboard-only web navigation works with visible focus.
- [ ] Screen-reader names/roles are meaningful.
- [ ] Text/background contrast meets WCAG AA for normal usage.
- [ ] Reduced-motion preference is honored.
- [ ] Mobile touch targets and dynamic text are usable.
- [ ] Loading, empty, validation and error states are announced clearly.
- [ ] Critical actions have explicit confirmation/status feedback.

## 13. Privacy and retention

- [ ] Route-session cleanup removes expired records.
- [ ] Expired/revoked live-location data is cleaned/anonymized according to policy.
- [ ] Rejected/abandoned media lifecycle cleanup is enabled.
- [ ] User export includes only the authenticated user's portable data.
- [ ] Deletion/anonymization workflow has been exercised in staging.
- [ ] Logs exclude tokens, payment tokens, PKCE values, OIDC codes and sensitive location plaintext.

## 14. Rollout and rollback

- [ ] Deploy API/migrations before clients that require the new contract.
- [ ] High-risk modules roll out behind feature flags where available.
- [ ] Property module is enabled gradually only after moderation/support readiness.
- [ ] Monitor readiness, 5xx rate, latency, DB saturation and security alerts during rollout.
- [ ] Rollback trigger thresholds and decision owner are known.
- [ ] If rollback is required, disable flags first, then roll application images back; prefer forward-fix migrations over destructive down migrations.

## Release approval

Do not merge/deploy when any required gate above is red or unknown. Record release commit, approver, deployment time, migration version, backup checkpoint and rollback commit in the release ticket/change record.
