[CmdletBinding()]
param([switch]$KeepVolumes)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command docker
    $args = @('compose','-f','compose.test.yml','down')
    if (-not $KeepVolumes) { $args += '-v' }
    Invoke-Checked docker @args
} finally { Pop-Location }
