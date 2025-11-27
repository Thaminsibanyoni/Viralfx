@echo off
REM Claude wrapper for Traycer - Foolproof bypass
setlocal

REM Try multiple methods to get the prompt
if not "%TRAYCER_PROMPT%"=="" (
    set PROMPT_CONTENT=%TRAYCER_PROMPT%
    goto :process
)

if not "%TRAYCER_PROMPT_FILE%"=="" (
    if exist "%TRAYCER_PROMPT_FILE%" (
        claude --file "%TRAYCER_PROMPT_FILE%"
        exit /b 0
    )
)

REM Try reading from stdin
powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()" 2>nul | findstr /r "." >nul
if not errorlevel 1 (
    powershell -Command "[System.Windows.Forms.Clipboard]::GetText()" | claude
    exit /b 0
)

echo No prompt found
exit /b 1

:process
REM Use temp file for any length prompt
set "TEMP_FILE=%TEMP%\claude_%RANDOM%.txt"
echo %PROMPT_CONTENT% > "%TEMP_FILE%"
claude --file "%TEMP_FILE%"
del "%TEMP_FILE%" 2>nul