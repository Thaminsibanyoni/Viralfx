# Enhanced Traycer Prompt Handler - Advanced Command Line Length Management
# Handles Windows PowerShell command line limitations more effectively

param(
    [string]$PromptFile = "",
    [string]$DirectPrompt = "",
    [switch]$ForceTemp,
    [int]$MaxLength = 4000  # Conservative threshold for PowerShell safety
)

# Function to get prompt content from multiple sources
function Get-PromptContent {
    param(
        [string]$DirectPrompt,
        [string]$PromptFile
    )

    if ($DirectPrompt) {
        return $DirectPrompt
    }

    if ($PromptFile -and (Test-Path $PromptFile)) {
        try {
            return Get-Content $PromptFile -Raw -Encoding UTF8
        } catch {
            Write-Error "Failed to read prompt file: $_"
            return $null
        }
    }

    if ($env:TRAYCER_PROMPT_FILE -and (Test-Path $env:TRAYCER_PROMPT_FILE)) {
        try {
            return Get-Content $env:TRAYCER_PROMPT_FILE -Raw -Encoding UTF8
        } catch {
            Write-Error "Failed to read environment prompt file: $_"
            return $null
        }
    }

    if ($env:TRAYCER_PROMPT) {
        return $env:TRAYCER_PROMPT
    }

    # Try to read from stdin if piped
    if (-not $Host.UI.RawUI.KeyAvailable) {
        try {
            $inputContent = [Console]::In.ReadToEnd()
            if ($inputContent.Trim()) {
                return $inputContent
            }
        } catch {
            # Ignore stdin read errors
        }
    }

    return $null
}

# Function to execute Claude with optimal method
function Invoke-ClaudeWithPrompt {
    param(
        [string]$PromptContent,
        [int]$MaxLength,
        [switch]$ForceTemp
    )

    if (-not $PromptContent.Trim()) {
        Write-Error "Empty prompt content."
        return $false
    }

    $contentLength = $PromptContent.Length
    Write-Host "Processing Traycer prompt ($contentLength characters)..."

    try {
        # Always use temporary file for very long prompts or when forced
        if ($ForceTemp -or $contentLength -gt $MaxLength) {
            # Use a more descriptive temp file name
            $tempDir = [System.IO.Path]::GetTempPath()
            $tempFile = Join-Path $tempDir "traycer_prompt_$(Get-Random).txt"

            # Write with UTF-8 encoding without BOM for better compatibility
            $utf8WithoutBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($tempFile, $PromptContent, $utf8WithoutBom)

            Write-Host "Using temporary file: $tempFile" -ForegroundColor Yellow

            try {
                # Execute Claude with the file
                $process = Start-Process -FilePath "claude" -ArgumentList "--file", "`"$tempFile`"" -Wait -PassThru -NoNewWindow
                $success = $process.ExitCode -eq 0

                if (-not $success) {
                    Write-Warning "Claude exited with code: $($process.ExitCode)"
                }

                return $success
            } finally {
                # Clean up temp file
                if (Test-Path $tempFile) {
                    Remove-Item $tempFile -ErrorAction SilentlyContinue -Force
                }
            }
        } else {
            # For shorter prompts, use pipe method
            Write-Host "Using direct pipe method..." -ForegroundColor Green

            # Ensure proper encoding for pipe
            $promptContent | & "claude"
            $success = $LASTEXITCODE -eq 0

            if (-not $success) {
                Write-Warning "Claude exited with code: $LASTEXITCODE"
            }

            return $success
        }
    } catch {
        Write-Error "Failed to execute Claude: $_"
        return $false
    }
}

# Main execution
$promptContent = Get-PromptContent -DirectPrompt $DirectPrompt -PromptFile $PromptFile

if (-not $promptContent) {
    Write-Error "No prompt content found."
    Write-Host "`nUsage methods:" -ForegroundColor Cyan
    Write-Host "  .\traycer-handler.ps1 -DirectPrompt 'your prompt here'"
    Write-Host "  .\traycer-handler.ps1 -PromptFile 'prompt_file.txt'"
    Write-Host "  `$env:TRAYCER_PROMPT = 'prompt'; .\traycer-handler.ps1"
    Write-Host "  `$env:TRAYCER_PROMPT_FILE = 'prompt.txt'; .\traycer-handler.ps1"
    Write-Host "  echo 'prompt' | .\traycer-handler.ps1"
    Write-Host "  .\traycer-handler.ps1 -ForceTemp  # Force temp file usage"
    exit 1
}

$success = Invoke-ClaudeWithPrompt -PromptContent $promptContent -MaxLength $MaxLength -ForceTemp:$ForceTemp

if ($success) {
    Write-Host "Traycer prompt processing completed successfully." -ForegroundColor Green
    exit 0
} else {
    Write-Error "Traycer prompt processing failed."
    exit 1
}