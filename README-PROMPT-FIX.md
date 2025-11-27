# Traycer to Claude Code CLI - Prompt Forwarding Fix

## Problem
PowerShell has a command line length limit (8191 characters) that causes errors when forwarding long prompts from Traycer to Claude Code CLI:
```
PS C:\Users\Nombatheko\Desktop\Viral FX> claude "$env:TRAYCER_PROMPT"
The command line is too long.
```

## Solutions

### Option 1: File-based Input (Recommended)
```powershell
# Execute the wrapper script
.\claude-prompt.ps1

# Or call with explicit prompt
.\claude-prompt.ps1 -Prompt "Your long prompt here..."
```

### Option 2: Here-String Method
```powershell
# Execute the here-string wrapper
.\claude-here-string.ps1

# Or manual here-string usage
@"
$env:TRAYCER_PROMPT
"@ | claude
```

### Option 3: Environment Variable Wrapper
```powershell
# Set your prompt
$env:TRAYCER_PROMPT = "Your very long prompt that exceeds PowerShell's command line length limit..."

# Execute the wrapper
.\claude-env-wrapper.ps1
```

### Option 4: Direct Pipe Method
```powershell
# Simple pipe approach
$env:TRAYCER_PROMPT | claude

# Or with error handling
try {
    $env:TRAYCER_PROMPT | claude
} catch {
    # Fallback to file method
    $temp = New-TemporaryFile
    $env:TRAYCER_PROMPT | Out-File $temp -Encoding UTF8
    claude --input-file $temp.FullName
    Remove-Item $temp -Force
}
```

## Usage Instructions

1. **Choose your preferred solution** (Option 1 is most robust)
2. **Set up execution policy** if needed:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. **Use the wrapper scripts** instead of direct `claude "$env:TRAYCER_PROMPT"` calls

## Benefits
- ✅ Handles prompts of any length
- ✅ Bypasses PowerShell command line limits
- ✅ Clean temporary file management
- ✅ Error handling and fallbacks
- ✅ UTF-8 encoding support for special characters

## Integration with Traycer
Replace your current command in Traycer from:
```powershell
claude "$env:TRAYCER_PROMPT"
```

To:
```powershell
.\claude-prompt.ps1
```

Make sure the wrapper script is in your current directory or in your PATH.