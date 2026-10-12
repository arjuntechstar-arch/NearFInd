[CmdletBinding()]
param([switch]$Integration)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pnpm
    Write-Section 'API lint'
    Invoke-Checked pnpm '--filter' '@nearfind/api' 'lint'
    Write-Section 'API typecheck'
    Invoke-Checked pnpm '--filter' '@nearfind/api' 'typecheck'
    Write-Section 'API unit coverage'
    Invoke-Checked pnpm '--filter' '@nearfind/api' 'test:coverage'
    if ($Integration) {
        Write-Section 'API integration tests'
        Invoke-Checked pnpm '--filter' '@nearfind/api' 'test:integration'
    }
    Write-Section 'API build'
    Invoke-Checked pnpm '--filter' '@nearfind/api' 'build'
} finally { Pop-Location }
