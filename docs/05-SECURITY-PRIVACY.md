# 05 — Security, Privacy and Safety Standard

## Baselines

Use OWASP ASVS Level 2, OWASP API Security Top 10 and OWASP MASVS as engineering baselines. Threat-model location, dispatch, messaging, uploads, payments, moderation and administrator actions before release.

## Authentication/session security

- Prefer OIDC/OAuth 2.1 Authorization Code + PKCE.
- Keep access tokens short-lived.
- Rotate/revoke refresh tokens and detect reuse where IdP supports it.
- Web: prefer secure, HttpOnly, SameSite cookies/BFF pattern when practical; add CSRF protection for cookie-authenticated unsafe methods.
- Mobile: store secrets only in platform secure storage; never AsyncStorage/plain preferences.
- Support session revocation and recent re-authentication for destructive/security-sensitive actions.
- MFA/passkeys should be supported through the identity provider.

## Authorization

- Deny by default.
- Enforce permissions in API application/domain layer, not only controller decorators or UI.
- Verify ownership/tenant/provider relationship on every object-level request to prevent IDOR/BOLA.
- Operations/admin endpoints require explicit roles/scopes and audit events.

## API/network

- TLS only; HSTS in production.
- restrictive CORS allowlist; never `*` with credentials.
- rate limit by identity/IP/device-risk context as appropriate.
- request body size limits and timeouts.
- outbound HTTP allowlists/timeouts to reduce SSRF risk.
- validate redirect/callback URLs.
- idempotency on financial/dispatch mutations.

## Web headers

Use CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, frame restrictions via CSP `frame-ancestors`, and a suitable Permissions-Policy. Avoid unsafe-inline script where possible.

## Mobile

- no secrets/API admin keys embedded in app bundle
- maps client keys restricted by bundle/package/signing identifiers
- secure local storage for tokens
- sensitive screens protected from accidental logging/screenshot only where justified by UX and platform norms
- detect rooted/jailbroken devices only as a risk signal, never as sole security control
- certificate pinning is optional and must include safe rotation/recovery if used

## Location privacy

Exact location is sensitive operational data.

- Ask permission contextually.
- Give manual-location fallback.
- Use approximate/coarse location when exact precision is unnecessary.
- Live dispatch sharing requires explicit grant, visible active state, revoke control and TTL.
- Minimize location retention; document retention periods.
- Never sell or expose location history as a side effect of basic app use.

## Upload security

- signed upload URLs are short-lived and scoped
- validate extension + MIME + magic number
- max size/dimensions/duration
- random server-generated object keys
- malware scanning where applicable
- image recompression/metadata stripping to reduce EXIF privacy leaks
- no direct execution/serving from application origin

## Payments

Use provider-hosted/SDK tokenization so raw card data does not reach SpotNear servers. Verify server-side payment state; never trust client “payment succeeded” messages. Maintain a payment reference/audit trail without storing PAN/CVV.

## Abuse and community safety

- rate-limit reports/reviews/reactions
- reputation and moderation queue
- duplicate/spam detection
- report/block features
- protect against leaderboard/reward farming
- do not expose private reporter identity to public users

## Emergency safety

Do not impersonate or claim a public emergency dispatch integration. Regionally configure emergency-call deep links. Private roadside support must be labeled accurately. Safety text must be reviewed before production launch in each region.

## Logging/observability privacy

Never log access/refresh tokens, passwords, card data, full emergency-contact details, raw chat attachments or exact location by default. Use structured redaction. Trace IDs should not encode user data.

## Secrets and cloud

- use cloud secret manager/KMS
- least-privilege IAM per service
- short-lived CI cloud credentials via OIDC
- database private networking
- backups encrypted and restore-tested
- key rotation and break-glass procedure documented

## Security release gates

Release blocks on:

- committed secret
- critical dependency/container finding with reachable exploit path
- known auth/authorization bypass
- high-severity injection/SSRF/XSS with exploitability
- unsigned/unverified payment webhook
- broken object-level authorization
- production debug endpoints or stack traces
