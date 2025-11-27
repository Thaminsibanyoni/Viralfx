# Traycer-Claude Command Line Length Limit Fix

## Problem
Windows PowerShell and CMD have command line length limitations (approximately 8,191 characters). When Traycer sends long prompts to Claude CLI, this limit is exceeded, causing "prompt too long" errors.

## Solutions Implemented

### 1. Enhanced PowerShell Handler (`traycer-handler.ps1`)
- **Conservative threshold**: 4,000 characters (safer than the 8,000 limit)
- **Multiple input sources**: Direct prompt, files, environment variables, stdin
- **Smart execution**: Uses temporary files for long prompts, pipes for short ones
- **UTF-8 encoding**: Proper character handling without BOM
- **Error handling**: Comprehensive error reporting and exit codes

### 2. Enhanced Batch Handler (`traycer-handler.bat`)
- **Conservative threshold**: 3,000 characters (for CMD compatibility)
- **Robust file handling**: Special character support
- **Fallback mechanisms**: Multiple execution strategies
- **Clean error reporting**: Clear error messages and usage instructions

### 3. Quick Safe Launcher (`claude-safe-launch.bat`)
- **Clipboard support**: Automatically reads from Windows clipboard
- **Simple usage**: Direct prompt or clipboard input
- **Minimal dependencies**: Works with basic Windows installation

## Usage Methods

### PowerShell (Recommended)
```powershell
# Direct prompt
.\traycer-handler.ps1 -DirectPrompt "Your long prompt here..."

# From file
.\traycer-handler.ps1 -PromptFile "prompt.txt"

# Force temporary file usage
.\traycer-handler.ps1 -DirectPrompt "prompt" -ForceTemp

# Using environment variables
$env:TRAYCER_PROMPT = "Your prompt here..."
.\traycer-handler.ps1

$env:TRAYCER_PROMPT_FILE = "prompt.txt"
.\traycer-handler.ps1
```

### Batch File
```cmd
# Direct prompt
traycer-handler.bat "Your prompt here..."

# From file
traycer-handler.bat "" "prompt.txt"

# Force temporary file
traycer-handler.bat "" "" forcetemp

# Environment variables
set TRAYCER_PROMPT=Your prompt here...
traycer-handler.bat
```

### Quick Launcher
```cmd
# Direct prompt
claude-safe-launch.bat "Your prompt here..."

# From clipboard
# Copy text to clipboard, then run:
claude-safe-launch.bat
```

## Integration with Traycer

### Option 1: Environment Variable Method
1. Set Traycer to use environment variables instead of direct command line:
   ```cmd
   set TRAYCER_PROMPT_FILE=prompt.txt
   traycer-handler.bat
   ```

### Option 2: File-based Method
1. Configure Traycer to write prompts to a temporary file
2. Use the file input handlers:
   ```powershell
   .\traycer-handler.ps1 -PromptFile "traycer_temp.txt"
   ```

### Option 3: Clipboard Method
1. Configure Traycer to copy prompts to clipboard
2. Use the quick launcher:
   ```cmd
   claude-safe-launch.bat
   ```

## Configuration

### Threshold Adjustments
- **PowerShell**: Edit `$MaxLength = 4000` in `traycer-handler.ps1`
- **Batch**: Edit `set "SAFE_LENGTH=3000"` in `traycer-handler.bat`

### Temporary File Location
- Default: System temp directory (`%TEMP%`)
- Files are automatically cleaned up after execution

## Troubleshooting

### Common Issues
1. **"prompt too long" still occurs**
   - Reduce the threshold values in the handlers
   - Use the `-ForceTemp` parameter

2. **Special characters not working**
   - Use the PowerShell handler (better Unicode support)
   - Force temporary file usage

3. **Permissions errors**
   - Run PowerShell as Administrator
   - Check temp directory permissions

### Verification
Test with increasingly longer prompts:
```powershell
# Test with 1000 characters
.\traycer-handler.ps1 -DirectPrompt ("A" * 1000)

# Test with 5000 characters (should use temp file)
.\traycer-handler.ps1 -DirectPrompt ("A" * 5000)
```

## Performance Notes
- Temporary file method: Slightly slower but handles any length
- Pipe method: Faster for short prompts (< threshold)
- Clipboard method: Convenient but requires PowerShell

## Security Considerations
- Temporary files are created in system temp directory
- Files are deleted after execution (best effort)
- No persistent storage of prompt content