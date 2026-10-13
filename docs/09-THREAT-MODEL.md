# NearFind Threat Model

## Scope

This threat model covers the NearFind web, mobile and API surfaces, PostgreSQL/PostGIS, Redis, S3-compatible media storage, OIDC authentication, provider/admin workflows, bookings, private roadside assistance, rewards, and the feature-flagged property module.

The target is OWASP ASVS Level 2 for web/API controls and OWASP MASVS-aligned mobile practices.

## Trust boundaries

1. **Untrusted clients** — browsers and mobile apps. Client-supplied user IDs, roles, ownership claims, prices, reward balances, provider assignments and payment status are never trusted.
2. **OIDC provider** — validates end-user identity. NearFind only accepts configured issuer/audience/signature algorithms and does not consume client-controlled role claims.
3. **NearFind API** — authorization and business-state authority.
4. **PostgreSQL/PostGIS** — source of truth for durable business records.
5. **Redis** — cache/queue support only; it must never become the sole source of truth for bookings, payments, dispatch, rewards or authorization.
6. **Private object storage** — media remains private and is accessed through short-lived signed URLs scoped to authenticated user/purpose prefixes.
7. **Payment provider** — NearFind stores only opaque sandbox/provider references. PAN/CVV must never enter NearFind logs, storage or APIs.

## STRIDE and abuse cases

| Threat | Example | Controls |
| --- | --- | --- |
| Spoofing | Forged bearer token | OIDC issuer/audience/JWKS validation, asymmetric algorithm allowlist, bounded Authorization parsing |
| Tampering | User changes another provider location | Server-derived identity, provider ownership checks, optimistic versioning, audit events |
| Repudiation | Admin denies moderation/dispatch assignment | Append-only audit events with actor/resource/action/time |
| Information disclosure | Roadside coordinates leaked | AES-256-GCM field encryption, TTL live-location grants, explicit grant/revoke, authenticated dispatch access |
| Denial of service | Huge bodies or contribution spam | Fastify body limit/timeouts, contribution/fuel/dispatch quotas, DB-backed limits |
| Elevation of privilege | JWT role changed to ADMIN | Application role loaded from NearFind DB; token role claims ignored |
| IDOR/BOLA | Read another user's booking/favorite/dispatch | All protected object access is scoped to authenticated user/provider ownership/admin role |
| Payment replay | Duplicate authorization requests | User/booking idempotency keys and unique constraints |
| Slot oversell | Concurrent reservations | Pessimistic slot locks, capacity constraints, reservation expiry |
| Dispatch replay | Duplicate roadside request | User + idempotency-key uniqueness |
| Reward fraud | Client posts arbitrary points | Only server/admin-controlled awards, immutable ledger, unique idempotency keys |
| Media traversal | Reuse another user's object key | User/purpose object prefix checks, allowed MIME/size limits, private bucket |
| Stored XSS | Malicious review/listing content | Data is treated as text by clients; server does not emit executable markup; CSP should remain enabled at deployment edge |
| SSRF | User controls OIDC/S3 endpoint | Endpoints are operator environment configuration, never request parameters |

## Authentication and session controls

- Web uses Authorization Code + PKCE through a server-side Next.js BFF.
- Web access tokens remain in `HttpOnly`, `SameSite=Lax` cookies and are never placed in browser local/session storage.
- Unsafe BFF mutations enforce same-origin checks.
- Mobile uses Authorization Code + PKCE with no client secret and stores tokens in SecureStore, not AsyncStorage.
- API JWT verification is lazy in development but OIDC configuration is mandatory in staging/production.
- Bearer tokens have an explicit maximum length and whitespace validation to avoid polynomial-regex/DoS patterns.

## Sensitive data

Encrypted application fields use AES-256-GCM with a 12-byte IV and 16-byte authentication tag. `FIELD_ENCRYPTION_KEY` is mandatory in staging/production and must come from a secret manager/KMS. Rotate the key through a controlled migration; never commit it to source control.

Sensitive/high-risk data includes:
- emergency-contact phone numbers,
- roadside start/live coordinates,
- roadside notes,
- provider support phone numbers where applicable,
- authentication tokens.

Do not log raw tokens, encrypted-field plaintext, exact roadside coordinates, payment tokens, OIDC authorization codes, or PKCE verifiers.

## Location privacy

- Discovery requests foreground location only after explicit user action.
- Manual location is supported.
- Route-session coordinates are rounded and expire after 24 hours.
- Exact roadside live location requires an explicit, TTL-bound grant and can be revoked immediately.
- Emergency public calling is kept separate from private NearFind roadside dispatch. NearFind must never claim to dispatch government/public emergency services unless a verified integration is implemented.

## Media security

- Private bucket only.
- Presigned uploads expire after five minutes.
- Object keys are server-generated and scoped to `users/{userId}/{purpose}/...`.
- MIME and size allowlists are enforced before issuing upload intent.
- Production should run asynchronous malware/content scanning before publishing media URLs.
- EXIF/GPS metadata should be stripped from images before public publication.

## Business-state integrity

- Bookings and dispatch requests use explicit state machines.
- Slot inventory is locked during reservation/cancellation.
- Rewards use an immutable ledger; balance is derived, not directly updated.
- Property edits use optimistic version checks.
- Provider approval is an admin action and changes the server-side application role.

## Security testing gates

Every merge to `main` must require:
- repository lint/typecheck/tests/build checks,
- PostGIS migration + integration tests,
- Gitleaks,
- Semgrep OWASP/TypeScript rules,
- Trivy filesystem scan,
- CodeQL.

High/critical findings must block release unless explicitly risk-accepted with an owner, expiration date and mitigation plan.
