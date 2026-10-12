[CmdletBinding()]
param(
    [ValidateSet('None','Android','iOS')][string]$E2E = 'None'
)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pnpm
    Write-Section 'Mobile lint'
    Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'lint'
    Write-Section 'Mobile typecheck'
    Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'typecheck'
    Write-Section 'Mobile unit/component coverage'
    Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'test:coverage'
    Write-Section 'Expo health check'
    Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'exec' 'expo-doctor'
    if ($E2E -eq 'Android') {
        Write-Section 'Android mobile E2E'
        Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'test:e2e:android'
    } elseif ($E2E -eq 'iOS') {
        if (-not $IsMacOS) { throw 'iOS E2E requires macOS.' }
        Write-Section 'iOS mobile E2E'
        Invoke-Checked pnpm '--filter' '@spotnear/mobile' 'test:e2e:ios'
    }
} finally { Pop-Location }
