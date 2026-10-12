# 06 — Coding and Repository Standards

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` where feasible.
- No implicit `any`; avoid type assertions that bypass validation.
- Domain code is framework-light and side-effect controlled.
- Validate external data at runtime with DTO validation/Zod-generated schemas.
- Prefer named exports for reusable modules.
- Functions should do one job; avoid >50-line methods without a clear reason.
- No business logic in React components/controllers.

## Naming

- components/classes/types: PascalCase
- variables/functions/files: camelCase or kebab-case according to repository convention
- booleans: `is/has/can/should`
- events: past tense (`BookingConfirmed`)
- commands/use cases: imperative (`CreateBooking`)

## Frontend

- Server state via TanStack Query, not copied into global client stores.
- Local UI state stays local.
- Forms: React Hook Form + schema validation.
- Shared design tokens/components; do not duplicate raw CSS across screens.
- Route-level error/loading boundaries.
- All clickable non-native elements replaced with semantic buttons/links.
- Images require dimensions/responsive behavior and meaningful alt text where applicable.

## API

- Controllers translate transport concerns; application services orchestrate; domain enforces invariants.
- Repositories hide persistence details.
- Transactions are explicit around multi-write invariants.
- Never return ORM entities directly from public controllers.
- Map to response DTOs and whitelist fields.
- Every list endpoint is bounded/paginated.

## Database

- schema changes only via migrations
- migration review includes index/lock/runtime impact
- foreign keys and unique constraints enforce invariants
- use spatial indexes for geo
- use decimal/numeric for money, never IEEE float
- store monetary amount plus currency

## Error handling

- typed domain errors -> stable public error codes
- no catch-and-ignore
- log once at the appropriate boundary
- retry only transient operations and use exponential backoff + jitter

## Git/PR

- protected `main`
- changes via PR
- required CI/status checks
- no force push to protected branch
- CODEOWNERS for security/infra/payment/dispatch areas
- conventional commits recommended
- PR template requires test evidence and security/privacy impact

## Documentation

Update architecture decisions when introducing a major provider, state machine, privacy behavior or deployment change. Keep README setup commands executable.
