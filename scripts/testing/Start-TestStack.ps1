[CmdletBinding()]
param([int]$TimeoutSeconds = 120)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command docker
    Require-Command pnpm
    if (-not (Test-Path 'compose.test.yml')) { throw 'compose.test.yml not found at repository root.' }
    Write-Section 'Starting disposable test dependencies'
    Invoke-Checked docker 'compose' '-f' 'compose.test.yml' 'up' '-d' '--wait'
    Write-Section 'Applying test migrations'
    Invoke-Checked pnpm 'db:migrate:test'
    Write-Section 'Seeding deterministic test data'
    Invoke-Checked pnpm 'db:seed:test'
} finally { Pop-Location }
