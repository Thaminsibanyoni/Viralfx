#!/bin/bash

echo "=========================================="
echo "VIRALFX - Repository Cleanup Script"
echo "=========================================="
echo ""

# Remove unnecessary files
echo "Cleaning up temporary files..."
rm -rf backend-bullmq-fix-backup/
rm -f backend-*.log
rm -f frontend-*.log
rm -f *.py
rm -f fix-*.js
rm -f fix-*.sh
rm -f *fix*.py
rm -f comprehensive_*.py
rm -f final_*.py
rm -f rapid_*.py
rm -f absolute_*.py
rm -f corrected_*.py
rm -f simple_*.py
rm -f safe_*.py
rm -f smart_*.py
rm -f nuclear_*.py
rm -f precise_*.py
rm -f manual_*.py
rm -f *.backup
rm -f *.bak

echo "Removing log files..."
rm -rf logs/
rm -f *.log
rm -f backend-*.log
rm -f frontend-*.log

echo "Removing temporary directories..."
rm -rf tmp/
rm -rf .claude/
rm -rf backend/.backup_files/
rm -rf backend/backend/

echo "Removing archived documentation..."
rm -f ARCHIVED*.md
rm -f *_ARCHIVED.md 2>/dev/null
rm -f *TROUBLESHOOTING.md 2>/dev/null
rm -f TEMP*.md 2>/dev/null
rm -f AGENT3_*.md
rm -f CIRCULAR_*.md
rm -f BUILD_*.md
rm -f FIXES_*.md
rm -f STARTUP_*.md
rm -f TYPEORM_*.md
rm -f *_FIX_REPORT.md
rm -f backend-build-errors.log

echo "✓ Cleanup complete"
echo ""
