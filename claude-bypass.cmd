@echo off
REM Direct Claude bypass for Traycer - No command line length limits
REM Usage: claude-bypass.cmd (reads from TRAYCER_PROMPT or TRAYCER_PROMPT_FILE)

setlocal enabledelayedexpansion

if not "%TRAYCER_PROMPT%"=="" (
    echo Found TRAYCER_PROMPT environment variable
    echo !TRAYCER_PROMPT! > "%TEMP%\traycer_temp_%RANDOM%.txt"
    claude --file "%TEMP%\traycer_temp_%RANDOM%.txt"
    del "%TEMP%\traycer_temp_%RANDOM%.txt" 2>nul
    goto :eof
)

if not "%TRAYCER_PROMPT_FILE%"=="" (
    if exist "%TRAYCER_PROMPT_FILE%" (
        echo Using TRAYCER_PROMPT_FILE: %TRAYCER_PROMPT_FILE%
        claude --file "%TRAYCER_PROMPT_FILE%"
        goto :eof
    )
)

echo Error: No TRAYCER_PROMPT or TRAYCER_PROMPT_FILE found
pause