#!/usr/bin/env python3
"""
Traycer Prompt Handler - Cross-platform solution
Bypass command line length limitations for Claude CLI
"""

import os
import sys
import tempfile
import subprocess
import argparse

def get_prompt_content(args):
    """Get prompt content from various sources"""

    # Direct prompt argument
    if args.prompt:
        return args.prompt

    # Prompt file argument
    if args.file and os.path.exists(args.file):
        with open(args.file, 'r', encoding='utf-8') as f:
            return f.read()

    # Environment variables
    if os.getenv('TRAYCER_PROMPT_FILE') and os.path.exists(os.getenv('TRAYCER_PROMPT_FILE')):
        with open(os.getenv('TRAYCER_PROMPT_FILE'), 'r', encoding='utf-8') as f:
            return f.read()

    if os.getenv('TRAYCER_PROMPT'):
        return os.getenv('TRAYCER_PROMPT')

    # stdin (pipe input)
    if not sys.stdin.isatty():
        return sys.stdin.read()

    return None

def execute_claude(prompt_content, use_temp_file=False):
    """Execute Claude CLI with the prompt content"""

    if not prompt_content.strip():
        print("Error: Empty prompt content.", file=sys.stderr)
        return False

    try:
        # Use temporary file for very long prompts or when explicitly requested
        if use_temp_file or len(prompt_content) > 8000:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
                temp_file.write(prompt_content)
                temp_file_path = temp_file.name

            print(f"Using temporary file: {temp_file_path}")
            try:
                result = subprocess.run(['claude', '--file', temp_file_path],
                                      check=True,
                                      capture_output=False,
                                      text=True)
                return True
            finally:
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
        else:
            # Pipe directly to Claude for shorter prompts
            process = subprocess.Popen(['claude'],
                                     stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE,
                                     text=True)
            stdout, stderr = process.communicate(input=prompt_content)

            if stdout:
                print(stdout, end='')
            if stderr:
                print(stderr, file=sys.stderr)

            return process.returncode == 0

    except subprocess.CalledProcessError as e:
        print(f"Error executing Claude: {e}", file=sys.stderr)
        return False
    except FileNotFoundError:
        print("Error: 'claude' command not found. Please ensure Claude CLI is installed and in your PATH.", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='Traycer Prompt Handler for Claude CLI')
    parser.add_argument('prompt', nargs='?', help='Direct prompt content')
    parser.add_argument('-f', '--file', help='File containing prompt content')
    parser.add_argument('--temp', action='store_true', help='Force use of temporary file')

    args = parser.parse_args()

    prompt_content = get_prompt_content(args)

    if not prompt_content:
        print("Error: No prompt content found.", file=sys.stderr)
        print("\nUsage methods:")
        print("  traycer-handler.py 'your prompt here'")
        print("  traycer-handler.py -f prompt_file.txt")
        print("  echo 'prompt' | traycer-handler.py")
        print("  TRAYCER_PROMPT='prompt' traycer-handler.py")
        print("  TRAYCER_PROMPT_FILE=prompt.txt traycer-handler.py")
        sys.exit(1)

    print(f"Processing Traycer prompt ({len(prompt_content)} characters)...")

    success = execute_claude(prompt_content, args.temp)

    if success:
        print("\nTraycer prompt processing completed.")
        sys.exit(0)
    else:
        print("\nTraycer prompt processing failed.", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()