[CmdletBinding()]
param()
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pwsh
    Write-Section 'PowerShell script syntax validation'
    Get-ChildItem 'scripts/testing/*.ps1' | ForEach-Object {
        $tokens = $null; $errors = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors)
        if ($errors.Count -gt 0) {
            $errors | ForEach-Object { Write-Error "$($_.Extent.File):$($_.Extent.StartLineNumber) $($_.Message)" }
            throw "PowerShell syntax validation failed for $($_.Name)"
        }
    }
    if (Test-CommandExists 'Invoke-Pester') {
        Write-Section 'Pester tests'
        Invoke-Pester -Path 'tests/powershell' -CI
    } else {
        Write-Warning 'Pester not installed; syntax validation completed only.'
    }
} finally { Pop-Location }
