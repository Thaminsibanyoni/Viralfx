# Wrapper script that reads from TRAYCER_PROMPT environment variable
# and forwards it to Claude CLI without command line length issues

# Check if TRAYCER_PROMPT exists
$traycerPrompt = $env:TRAYCER_PROMPT

if ([string]::IsNullOrEmpty($traycerPrompt)) {
    Write-Host "Usage: " -ForegroundColor Yellow
    Write-Host "  `$env:TRAYCER_PROMPT = 'your prompt here'" -ForegroundColor Cyan
    Write-Host "  .\claude-env-wrapper.ps1" -ForegroundColor Cyan
    exit 1
}

# Method 1: Direct pipe (works for most cases)
try {
    $traycerPrompt | claude
    exit 0
}
catch {
    Write-Warning "Direct pipe failed, trying alternative method..."
}

# Method 2: Use Start-Process with redirected stdin
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    $traycerPrompt | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "claude"
    $processInfo.RedirectStandardInput = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.UseShellExecute = $false

    $process = [System.Diagnostics.Process]::Start($processInfo)

    # Write the prompt to stdin
    $process.StandardInput.Write($traycerPrompt)
    $process.StandardInput.Close()

    # Wait for completion and output results
    $process.WaitForExit()
    Write-Host $process.StandardOutput.ReadToEnd()
    if ($process.ExitCode -ne 0) {
        Write-Error $process.StandardError.ReadToEnd()
    }
}
finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}