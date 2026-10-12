[CmdletBinding()]
param(
    [string]$ApiBaseUrl = $(if ($env:SPOTNEAR_API_BASE_URL) { $env:SPOTNEAR_API_BASE_URL } else { 'http://localhost:4000' }),
    [string]$WebBaseUrl = $(if ($env:SPOTNEAR_WEB_BASE_URL) { $env:SPOTNEAR_WEB_BASE_URL } else { 'http://localhost:3000' })
)
$ErrorActionPreference = 'Stop'

function Assert-HttpOk([string]$Url) {
    Write-Host "GET $Url"
    $r = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 15 -UseBasicParsing
    if ($r.StatusCode -lt 200 -or $r.StatusCode -ge 400) { throw "Smoke check failed: $Url returned $($r.StatusCode)" }
}

Assert-HttpOk "$ApiBaseUrl/health/ready"
Assert-HttpOk "$WebBaseUrl/"
Write-Host 'Smoke checks passed.' -ForegroundColor Green
