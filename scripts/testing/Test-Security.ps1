[CmdletBinding()]
param(
    [string]$BaseUrl = $env:SPOTNEAR_TEST_BASE_URL,
    [switch]$AllowMissingTools
)
. "$PSScriptRoot/_Common.ps1"
$root = Push-RepoRoot
try {
    Require-Command pnpm
    Write-Section 'Production dependency audit'
    Invoke-Checked pnpm 'audit' '--prod' '--audit-level' 'high'

    $tools = @('gitleaks','semgrep','trivy')
    foreach ($tool in $tools) {
        if (-not (Test-CommandExists $tool)) {
            if ($AllowMissingTools) { Write-Warning "$tool not installed; skipping."; continue }
            throw "Security tool '$tool' is required."
        }
        switch ($tool) {
            'gitleaks' {
                Write-Section 'Secret scan'
                Invoke-Checked gitleaks 'detect' '--source' '.' '--no-banner' '--redact'
            }
            'semgrep' {
                Write-Section 'SAST (OWASP/TypeScript)'
                Invoke-Checked semgrep 'scan' '--config' 'p/owasp-top-ten' '--config' 'p/typescript' '--error' '.'
            }
            'trivy' {
                Write-Section 'Filesystem vulnerability / secret / misconfiguration scan'
                Invoke-Checked trivy 'fs' '--exit-code' '1' '--severity' 'HIGH,CRITICAL' '--scanners' 'vuln,secret,misconfig' '.'
            }
        }
    }

    if ($BaseUrl) {
        if (-not (Test-CommandExists docker)) {
            if ($AllowMissingTools) { Write-Warning 'docker not installed; skipping ZAP baseline.' }
            else { throw 'docker is required for ZAP baseline.' }
        } else {
            Write-Section "OWASP ZAP baseline against $BaseUrl"
            $out = Join-Path $root 'artifacts/zap'
            New-Item -ItemType Directory -Force -Path $out | Out-Null
            # The target must be reachable from the Docker daemon. For host services use host.docker.internal where supported.
            Invoke-Checked docker 'run' '--rm' '-v' "${out}:/zap/wrk/:rw" 'ghcr.io/zaproxy/zaproxy:stable' 'zap-baseline.py' '-t' $BaseUrl '-J' 'zap-report.json' '-I'
        }
    } else {
        Write-Host 'SPOTNEAR_TEST_BASE_URL not set; dynamic ZAP baseline skipped.' -ForegroundColor Yellow
    }
} finally { Pop-Location }
