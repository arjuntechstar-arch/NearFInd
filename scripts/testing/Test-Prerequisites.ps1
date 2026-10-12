[CmdletBinding()]
param(
    [switch]$SecurityTools,
    [switch]$PerformanceTools
)
. "$PSScriptRoot/_Common.ps1"

Write-Section 'Checking base prerequisites'
$required = @('node', 'pnpm', 'git')
foreach ($cmd in $required) { Require-Command $cmd }
Invoke-Checked node '--version'
Invoke-Checked pnpm '--version'

if ($SecurityTools) {
    Write-Section 'Checking security tools'
    foreach ($cmd in @('gitleaks','semgrep','trivy','docker')) { Require-Command $cmd }
}
if ($PerformanceTools) {
    Write-Section 'Checking performance tools'
    Require-Command 'k6'
}
Write-Host 'Prerequisites OK.' -ForegroundColor Green
