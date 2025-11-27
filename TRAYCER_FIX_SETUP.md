# Fix Traycer "Command Line Too Long" Error

## Problem
The Traycer VSCode extension automatically runs: `claude "$env:TRAYCER_PROMPT"`
This fails when the prompt is longer than Windows PowerShell's 8,191 character limit.

## Solution Steps

### Step 1: Rename the Real Claude CLI
First, we need to rename the real claude executable so our interceptor can handle the calls:

```powershell
# Find where claude is installed
where claude

# Rename the real claude to claude.exe.original
# (Adjust path based on where claude is installed)
# Example: If it's in C:\Program Files\Claude\claude.exe
# Rename it to: C:\Program Files\Claude\claude.exe.original
```

### Step 2: Use Our PowerShell Interceptor
Copy `claude.ps1` to a location in your PATH, or use the full path:

```powershell
# Test the interceptor
.\claude.ps1 --version

# If it works, move it to a directory in your PATH
# or create a batch file wrapper
```

### Step 3: Create a Batch File Wrapper (Recommended)
Create `claude.bat` in a directory in your PATH:

```batch
@echo off
powershell -ExecutionPolicy Bypass -File "C:\Users\Nombatheko\Desktop\Viral FX\claude.ps1" %*
```

### Step 4: Test the Fix
```powershell
# Set a very long test prompt
$env:TRAYCER_PROMPT = "This is a test prompt. " * 1000

# Test our interceptor
claude "$env:TRAYCER_PROMPT"
```

### Step 5: Test with Traycer
1. Restart VSCode
2. Use Traycer to generate a long prompt
3. Click "Fix Traycer" - it should now work!

## Alternative: Use Existing Scripts
If the above doesn't work, you can modify the Traycer extension settings:

### Option A: VSCode Settings
Add this to your VSCode settings.json:
```json
{
    "traycer.commandTemplate": "powershell -ExecutionPolicy Bypass -File \"C:\\Users\\Nombatheko\\Desktop\\Viral FX\\claude-bypass.ps1\""
}
```

### Option B: Environment Variable Method
Set this environment variable:
```powershell
$env:TRAYCER_CLAUDE_COMMAND = "powershell -ExecutionPolicy Bypass -File \"C:\\Users\\Nombatheko\\Desktop\\Viral FX\\claude-bypass.ps1\""
```

## How It Works
1. Traycer calls: `claude "$env:TRAYCER_PROMPT"`
2. Our interceptor catches the call
3. Detects if it's a TRAYCER_PROMPT call
4. Writes the prompt to a temporary file (bypassing command line limit)
5. Calls the real claude with: `claude --file temp.txt`
6. Cleans up the temporary file

## Troubleshooting
- Make sure PowerShell execution policy allows scripts: `Set-ExecutionPolicy RemoteSigned`
- Verify the real claude.exe can be found: `where claude.exe.original`
- Check that our interceptor is in the PATH: `where claude.bat`