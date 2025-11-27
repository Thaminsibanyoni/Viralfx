@echo off
REM Enhanced Traycer Prompt Handler - Optimized for Windows Command Line Limits
REM Handles PowerShell and CMD limitations more effectively

setlocal enabledelayedexpansion

REM Configuration
set "SAFE_LENGTH=3000"
set "TEMP_DIR=%TEMP%"

REM Parse command line arguments
set "DIRECT_PROMPT=%~1"
set "PROMPT_FILE=%~2"
set "FORCE_TEMP=%~3"

REM Function to get prompt content
:resolve_prompt_content
if defined DIRECT_PROMPT (
    if not "%DIRECT_PROMPT%"=="" (
        set "PROMPT_CONTENT=%DIRECT_PROMPT%"
        goto :execute_claude
    )
)

if defined PROMPT_FILE (
    if not "%PROMPT_FILE%"=="" (
        if exist "%PROMPT_FILE%" (
            REM Read file properly handling special characters
            for /f "delims=" %%a in ('type "%PROMPT_FILE%"') do set "PROMPT_CONTENT=!PROMPT_CONTENT!%%a" & echo.>>nul
            goto :execute_claude
        ) else (
            echo Error: Prompt file not found: %PROMPT_FILE%
            goto :show_usage
        )
    )
)

if defined TRAYCER_PROMPT_FILE (
    if not "%TRAYCER_PROMPT_FILE%"=="" (
        if exist "%TRAYCER_PROMPT_FILE%" (
            for /f "delims=" %%a in ('type "%TRAYCER_PROMPT_FILE%"') do set "PROMPT_CONTENT=!PROMPT_CONTENT!%%a" & echo.>>nul
            goto :execute_claude
        )
    )
)

if defined TRAYCER_PROMPT (
    if not "%TRAYCER_PROMPT%"=="" (
        set "PROMPT_CONTENT=%TRAYCER_PROMPT%"
        goto :execute_claude
    )
)

REM Check for piped input (only if not interactive)
echo %CMDCMDLINE% | find "traycer-handler.bat" >nul
if errorlevel 1 (
    REM No piped input available in batch
    goto :show_usage
)

:show_usage
echo Error: No prompt content found.
echo.
echo Usage methods:
echo   traycer-handler.bat "your prompt here"
echo   traycer-handler.bat "" "prompt_file.txt"
echo   traycer-handler.bat "" "" forcetemp
echo.
echo Or set environment variables:
echo   set TRAYCER_PROMPT="your prompt"
echo   set TRAYCER_PROMPT_FILE=prompt.txt
echo.
exit /b 1

:execute_claude
if defined PROMPT_CONTENT (
    REM Calculate length safely
    call :safe_strlen PROMPT_LENGTH PROMPT_CONTENT
    echo Processing Traycer prompt (!PROMPT_LENGTH! characters)...

    REM Determine execution method
    if "%FORCE_TEMP%"=="forcetemp" (
        set "USE_TEMP_FILE=1"
    ) else if !PROMPT_LENGTH! GTR %SAFE_LENGTH% (
        set "USE_TEMP_FILE=1"
    ) else (
        set "USE_TEMP_FILE=0"
    )

    if "!USE_TEMP_FILE!"=="1" (
        REM Use temporary file method
        echo Using temporary file method...
        set "TEMP_FILE=%TEMP_DIR%\traycer_prompt_%RANDOM%_%TIME:~6,5%.txt"

        REM Escape special characters for file output
        set "ESCAPED_CONTENT=!PROMPT_CONTENT!"

        REM Write to temporary file
        (
            echo !PROMPT_CONTENT!
        ) >"!TEMP_FILE!" 2>nul

        if exist "!TEMP_FILE!" (
            echo Temporary file created: !TEMP_FILE!

            REM Execute Claude with file input
            claude --file "!TEMP_FILE!"
            set "CLAUDE_EXITCODE=!ERRORLEVEL!"

            REM Clean up
            del "!TEMP_FILE!" 2>nul

            if !CLAUDE_EXITCODE! EQU 0 (
                echo Traycer prompt processing completed successfully.
                exit /b 0
            ) else (
                echo Claude exited with code: !CLAUDE_EXITCODE!
                exit /b !CLAUDE_EXITCODE!
            )
        ) else (
            echo Error: Failed to create temporary file.
            exit /b 1
        )
    ) else (
        REM Use pipe method for shorter prompts
        echo Using direct pipe method...

        REM Create a temporary file anyway for better reliability with special characters
        set "PIPE_TEMP_FILE=%TEMP_DIR%\traycer_pipe_%RANDOM%.txt"
        (
            echo !PROMPT_CONTENT!
        ) >"!PIPE_TEMP_FILE!" 2>nul

        if exist "!PIPE_TEMP_FILE!" (
            type "!PIPE_TEMP_FILE!" | claude
            set "CLAUDE_EXITCODE=!ERRORLEVEL!"
            del "!PIPE_TEMP_FILE!" 2>nul

            if !CLAUDE_EXITCODE! EQU 0 (
                echo Traycer prompt processing completed successfully.
                exit /b 0
            ) else (
                echo Claude exited with code: !CLAUDE_EXITCODE!
                exit /b !CLAUDE_EXITCODE!
            )
        ) else (
            REM Fallback to direct echo (may have issues with special chars)
            echo !PROMPT_CONTENT! | claude
            set "CLAUDE_EXITCODE=!ERRORLEVEL!"
            exit /b !CLAUDE_EXITCODE!
        )
    )
) else (
    echo Error: Empty prompt content.
    exit /b 1
)

: safe_strlen
REM Safe string length calculation
set "str=%~2"
set "len=0"
if defined str (
    :strlen_loop
    if not "!str:~%len%,1!"=="" (
        set /a len+=1
        goto :strlen_loop
    )
)
endlocal & set "%~1=%len%"
goto :eof