[CmdletBinding()]
param([switch]$E2E)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pnpm
    Write-Section 'Web lint'
    Invoke-Checked pnpm '--filter' '@spotnear/web' 'lint'
    Write-Section 'Web typecheck'
    Invoke-Checked pnpm '--filter' '@spotnear/web' 'typecheck'
    Write-Section 'Web unit/component coverage'
    Invoke-Checked pnpm '--filter' '@spotnear/web' 'test:coverage'
    Write-Section 'Web production build'
    Invoke-Checked pnpm '--filter' '@spotnear/web' 'build'
    if ($E2E) {
        Write-Section 'Web Playwright E2E'
        Invoke-Checked pnpm '--filter' '@spotnear/web' 'test:e2e'
        Write-Section 'Web accessibility E2E'
        Invoke-Checked pnpm '--filter' '@spotnear/web' 'test:a11y'
        Write-Section 'Web visual regression'
        Invoke-Checked pnpm '--filter' '@spotnear/web' 'test:visual'
    }
} finally { Pop-Location }
