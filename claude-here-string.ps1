# Forward Traycer prompts using here-strings to avoid command line length limits

param(
    [string]$Prompt = $env:TRAYCER_PROMPT
)

if ([string]::IsNullOrEmpty($Prompt)) {
    Write-Error "No prompt provided. Set TRAYCER_PROMPT environment variable or pass as parameter."
    exit 1
}

# Use here-string to pass the prompt to Claude
$hereString = @"
$Prompt
"@

# Pipe the here-string to Claude CLI
$hereString | claude