# PowerShell test runners

Run with PowerShell 7 (`pwsh`) from any directory.

```powershell
pwsh ./scripts/testing/Test-All.ps1 -Profile Quick
pwsh ./scripts/testing/Test-All.ps1 -Profile Full
$env:SPOTNEAR_TEST_BASE_URL='https://staging.example.com'
pwsh ./scripts/testing/Test-All.ps1 -Profile Release
```

Security Full profile expects `gitleaks`, `semgrep`, `trivy` and optionally Docker for ZAP. Pass `-AllowMissingSecurityTools` only for a developer workstation; protected CI should install the tools and must not skip required scans.

Mobile iOS E2E requires macOS. Android/iOS device-level E2E is best run in dedicated CI jobs because emulators are expensive.
