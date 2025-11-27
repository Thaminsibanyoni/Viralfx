# Direct Claude bypass for Traycer - PowerShell version
param()

if ($env:TRAYCER_PROMPT) {
    Write-Host "Processing TRAYCER_PROMPT ($($env:TRAYCER_PROMPT.Length) characters)"
    $tempFile = Join-Path $env:TEMP "traycer_temp_$([System.Guid]::NewGuid().ToString('N')).txt"
    $env:TRAYCER_PROMPT | Out-File -FilePath $tempFile -Encoding UTF8
    claude --file $tempFile
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}
elseif ($env:TRAYCER_PROMPT_FILE -and (Test-Path $env:TRAYCER_PROMPT_FILE)) {
    Write-Host "Processing TRAYCER_PROMPT_FILE: $env:TRAYCER_PROMPT_FILE"
    claude --file $env:TRAYCER_PROMPT_FILE
}
else {
    Write-Error "No TRAYCER_PROMPT or TRAYCER_PROMPT_FILE found"
    exit 1
}