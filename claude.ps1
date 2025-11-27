# Claude CLI PowerShell Interceptor for Traycer
# This script intercepts claude calls and handles long prompts properly

param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Arguments
)

# Function to detect if this is a problematic TRAYCER_PROMPT call
function Test-TraycerPromptCall {
    param([string[]]$Args)

    # Check if we're being called with a single argument that looks like TRAYCER_PROMPT
    if ($Args.Count -eq 1 -and $Args[0] -match '^\$env:TRAYCER_PROMPT$') {
        return $true
    }

    # Check if the arguments contain TRAYCER_PROMPT expansion that would be too long
    if ($Args -join ' ' -match '\$env:TRAYCER_PROMPT') {
        return $true
    }

    return $false
}

# Function to handle TRAYCER_PROMPT properly
function Invoke-TraycerPromptHandler {
    if ($env:TRAYCER_PROMPT) {
        Write-Host "Intercepting TRAYCER_PROMPT call ($($env:TRAYCER_PROMPT.Length) characters)..." -ForegroundColor Yellow

        # Create temporary file
        $tempFile = Join-Path $env:TEMP "traycer_prompt_$([System.Guid]::NewGuid().ToString('N')).txt"

        try {
            # Write prompt to temp file with UTF-8 encoding without BOM
            $utf8WithoutBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($tempFile, $env:TRAYCER_PROMPT, $utf8WithoutBom)

            # Call real claude with the file
            $process = Start-Process -FilePath "claude.exe" -ArgumentList "--file", "`"$tempFile`"" -Wait -PassThru -NoNewWindow
            return $process.ExitCode
        }
        finally {
            # Clean up
            if (Test-Path $tempFile) {
                Remove-Item $tempFile -ErrorAction SilentlyContinue -Force
            }
        }
    }
    else {
        Write-Error "TRAYCER_PROMPT environment variable not found"
        return 1
    }
}

# Function to call real claude with original arguments
function Invoke-RealClaude {
    param([string[]]$Args)

    try {
        # Find the real claude executable
        $claudePath = Get-Command "claude.exe" -ErrorAction SilentlyContinue
        if (-not $claudePath) {
            $claudePath = Get-Command "claude" -ErrorAction SilentlyContinue
        }

        if (-not $claudePath) {
            Write-Error "Claude CLI not found in PATH"
            return 1
        }

        # Call the real claude
        $process = Start-Process -FilePath $claudePath.Source -ArgumentList $Args -Wait -PassThru -NoNewWindow
        return $process.ExitCode
    }
    catch {
        Write-Error "Failed to execute Claude: $_"
        return 1
    }
}

# Main execution
if (Test-TraycerPromptCall -Args $Arguments) {
    $exitCode = Invoke-TraycerPromptHandler
}
else {
    $exitCode = Invoke-RealClaude -Args $Arguments
}

exit $exitCode