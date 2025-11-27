@echo off
REM Claude CLI Interceptor for Traycer Extension
REM This fixes the "command line too long" error

setlocal enabledelayedexpansion

REM Check if we're being called with TRAYCER_PROMPT environment variable
if not "%TRAYCER_PROMPT%"=="" (
    echo Intercepting TRAYCER_PROMPT call...

    REM Create a temporary file
    set "tempFile=%TEMP%\traycer_prompt_%RANDOM%_%TIME:~6,5%.txt"

    REM Use PowerShell to write the prompt with proper encoding
    powershell -Command "$env:TRAYCER_PROMPT | Out-File -FilePath '%tempFile%' -Encoding UTF8 -NoNewline"

    REM Call the original claude.cmd with the file
    call "C:\Users\Nombatheko\AppData\Roaming\npm\claude.cmd" --file "%tempFile%"

    REM Clean up temp file
    if exist "%tempFile%" del "%tempFile%" 2>nul
    exit /b %ERRORLEVEL%
)

REM For all other calls, pass through to original claude
call "C:\Users\Nombatheko\AppData\Roaming\npm\claude.cmd" %*
exit /b %ERRORLEVEL%