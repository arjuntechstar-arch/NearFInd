[CmdletBinding()]
param([string]$BaseUrl = $env:SPOTNEAR_TEST_BASE_URL)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command k6
    if (-not $BaseUrl) { throw 'Set SPOTNEAR_TEST_BASE_URL or pass -BaseUrl.' }
    $env:BASE_URL = $BaseUrl
    Write-Section "k6 performance smoke against $BaseUrl"
    Invoke-Checked k6 'run' 'tests/performance/smoke.js'
} finally { Pop-Location }
