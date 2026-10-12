# 11 — Local Setup Contract Expected by Test Scripts

The generated repository should expose these root commands so the supplied PowerShell runners stay stable:

```json
{
  "scripts": {
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "build": "turbo build",
    "openapi:check": "...",
    "db:migrate:test": "...",
    "db:seed:test": "..."
  }
}
```

Expected package names:

- `@spotnear/web`
- `@spotnear/mobile`
- `@spotnear/api`

Expected package scripts where relevant:

- `lint`
- `typecheck`
- `test:coverage`
- `test:integration`
- `build`
- web: `test:e2e`, `test:a11y`, `test:visual`
- mobile: `test:e2e:android`, `test:e2e:ios` (may be CI/nightly only)

Local services should be declared in `compose.test.yml` and expose a health-checkable API when started by test orchestration.
