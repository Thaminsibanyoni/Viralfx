# Forward Traycer prompts to Claude Code CLI
# Handles long prompts by using file-based input

param(
    [string]$Prompt = $env:TRAYCER_PROMPT
)

if ([string]::IsNullOrEmpty($Prompt)) {
    Write-Error "No prompt provided. Set TRAYCER_PROMPT environment variable or pass as parameter."
    exit 1
}

# Create a temporary file for the prompt
$tempFile = New-TemporaryFile
try {
    # Write prompt to temp file with UTF-8 encoding
    $Prompt | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

    # Execute Claude CLI with file input
    & claude --input-file $tempFile.FullName
}
finally {
    # Clean up temp file
    if (Test-Path $tempFile.FullName) {
        Remove-Item $tempFile.FullName -Force
    }
}