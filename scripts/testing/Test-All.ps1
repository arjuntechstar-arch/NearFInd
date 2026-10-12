[CmdletBinding()]
param(
    [ValidateSet('Quick','Full','Release')][string]$Profile = 'Full',
    [switch]$AllowMissingSecurityTools,
    [string]$BaseUrl = $env:SPOTNEAR_TEST_BASE_URL
)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pnpm
    Write-Section "SpotNear quality gate: $Profile"
    Invoke-Checked pnpm 'install' '--frozen-lockfile'

    & "$PSScriptRoot/Test-PowerShell.ps1"
    if ($LASTEXITCODE -ne 0) { throw 'PowerShell validation failed.' }

    Write-Section 'Repository lint'
    Invoke-Checked pnpm 'lint'
    Write-Section 'Repository typecheck'
    Invoke-Checked pnpm 'typecheck'
    Write-Section 'Repository unit tests'
    Invoke-Checked pnpm 'test'

    if ($Profile -in @('Full','Release')) {
        & "$PSScriptRoot/Start-TestStack.ps1"
        try {
            & "$PSScriptRoot/Test-Api.ps1" -Integration
            & "$PSScriptRoot/Test-Web.ps1" -E2E
            & "$PSScriptRoot/Test-Mobile.ps1"
            & "$PSScriptRoot/Test-Security.ps1" -BaseUrl $BaseUrl -AllowMissingTools:$AllowMissingSecurityTools
            Write-Section 'Repository production build'
            Invoke-Checked pnpm 'build'
        } finally {
            & "$PSScriptRoot/Stop-TestStack.ps1"
        }
    }

    if ($Profile -eq 'Release') {
        if (-not $BaseUrl) { throw 'Release profile requires -BaseUrl or SPOTNEAR_TEST_BASE_URL for deployed staging.' }
        & "$PSScriptRoot/Test-Performance.ps1" -BaseUrl $BaseUrl
    }

    Write-Host "`nSpotNear $Profile quality gate PASSED." -ForegroundColor Green
} finally { Pop-Location }
