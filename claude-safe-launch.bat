@echo off
REM Claude Safe Launcher - Bypasses Windows Command Line Length Limits
REM Use this when Traycer prompts are too long for direct CLI execution

setlocal enabledelayedexpansion

REM Get input from clipboard or stdin
set "PROMPT_CONTENT="

REM Try to get from Windows PowerShell clipboard if available
powershell -Command "try { Get-Clipboard } catch { '' }" 2>nul > "%TEMP%\clipboard_content.txt"

if exist "%TEMP%\clipboard_content.txt" (
    set /p PROMPT_CONTENT=<"%TEMP%\clipboard_content.txt"
    del "%TEMP%\clipboard_content.txt" 2>nul
)

REM If no clipboard content, try command line argument
if not defined PROMPT_CONTENT (
    set "PROMPT_CONTENT=%~1"
)

REM If still no content, show usage
if not defined PROMPT_CONTENT (
    echo Usage: claude-safe-launch.bat "your prompt here"
    echo.
    echo Or copy your prompt to clipboard and run: claude-safe-launch.bat
    echo.
    pause
    exit /b 1
)

REM Create a temporary file with the prompt
set "TEMP_FILE=%TEMP%\claude_prompt_%RANDOM%_%TIME:~6,2%.txt"
echo %PROMPT_CONTENT% > "%TEMP_FILE%"

REM Execute Claude with the file
echo Executing Claude with prompt from temporary file...
claude --file "%TEMP_FILE%"

REM Clean up
del "%TEMP_FILE%" 2>nul

echo.
echo Claude execution completed.
pause