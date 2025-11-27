@echo off
echo Testing Traycer Command Line Length Fix Solutions
echo ================================================

echo.
echo Test 1: PowerShell handler with short prompt (should use pipe)
powershell -ExecutionPolicy Bypass -File "C:\Users\Nombatheko\Desktop\Viral FX\traycer-handler.ps1" -DirectPrompt "Short test prompt"

echo.
echo Test 2: PowerShell handler with long prompt (should use temp file)
powershell -ExecutionPolicy Bypass -File "C:\Users\Nombatheko\Desktop\Viral FX\traycer-handler.ps1" -ForceTemp -DirectPrompt "This is a longer test prompt to trigger temporary file usage. %RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%"

echo.
echo Test 3: Batch handler with short prompt
call "C:\Users\Nombatheko\Desktop\Viral FX\traycer-handler.bat" "Short batch test prompt"

echo.
echo Test 4: Batch handler with long prompt (forcing temp file)
call "C:\Users\Nombatheko\Desktop\Viral FX\traycer-handler.bat" "" "" forcetemp

echo.
echo Test 5: Safe launcher with clipboard simulation
echo Test prompt content > "%TEMP%\test_clipboard.txt"
powershell -Command "Set-Content -Path 'test_prompt.txt' -Value 'Safe launcher test prompt with some content %RANDOM%'"
call "C:\Users\Nombatheko\Desktop\Viral FX\claude-safe-launch.bat" "Safe launcher test from command line"

echo.
echo All tests completed. Check the output above for method selection and execution status.
pause