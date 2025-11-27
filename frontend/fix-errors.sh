#!/bin/bash

echo "🔧 Fixing TypeScript and Vite Build Issues..."

# 1. Update Sass to fix deprecation warnings
echo "📦 Updating Sass to fix deprecation warnings..."
npm install --save-dev sass@latest

# 2. Try to resolve memory issues with Node.js options
export NODE_OPTIONS="--max-old-space-size=4096"

# 3. Clean dist folder if it exists
if [ -d "dist" ]; then
    echo "🧹 Cleaning dist folder..."
    rm -rf dist
fi

# 4. Install missing dependencies if any
echo "📦 Ensuring all dependencies are installed..."
npm install

# 5. Run TypeScript type check (should pass)
echo "🔍 Running TypeScript type check..."
npx tsc --noEmit

# 6. Run ESLint with auto-fix for minor issues
echo "🔧 Running ESLint auto-fix..."
npx eslint . --fix

# 7. Try a smaller build first to isolate issues
echo "🏗️ Running Vite build with increased memory..."
NODE_OPTIONS="--max-old-space-size=4096" npx vite build

echo "✅ Error fixing process completed!"