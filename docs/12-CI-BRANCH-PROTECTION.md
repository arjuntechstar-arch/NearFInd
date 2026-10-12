# 12 — CI and Main-Branch Protection

Recommended GitHub ruleset for `main`:

- require pull request before merge
- require at least 1–2 approvals depending team size
- dismiss stale approvals on new commits
- require review from CODEOWNERS for security/infra/payment/dispatch paths
- require conversation resolution
- require status checks: `CI / quality`, `CodeQL / analyze` and any deployment policy check
- require branch to be up to date before merge if your merge queue does not handle it
- block force pushes and deletions
- require signed commits if organization policy supports it
- restrict direct pushes; use break-glass team only

For commits pushed directly to `main` under break-glass permissions, the same `push: branches: [main]` CI trigger runs, but prevention is preferred over detecting bad direct pushes after the fact.
