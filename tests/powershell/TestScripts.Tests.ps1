Describe 'SpotNear test script pack' {
    It 'contains the canonical orchestrator' {
        Test-Path 'scripts/testing/Test-All.ps1' | Should -BeTrue
    }
    It 'contains security and performance runners' {
        Test-Path 'scripts/testing/Test-Security.ps1' | Should -BeTrue
        Test-Path 'scripts/testing/Test-Performance.ps1' | Should -BeTrue
    }
}
