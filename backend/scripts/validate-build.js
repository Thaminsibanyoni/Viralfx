#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to print colored messages
function print(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper function to check if a directory exists
function directoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

// Helper function to check if a file exists
function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function printSuccess(message) {
  print('green', `✅ ${message}`);
}

function printError(message) {
  print('red', `❌ ${message}`);
}

function printWarning(message) {
  print('yellow', `⚠️  ${message}`);
}

function printInfo(message) {
  print('blue', `ℹ️  ${message}`);
}

function validateDependencies() {
  printInfo('Validating dependencies...');

  const requiredDirs = [
    'node_modules/@nestjs/cache-manager',
    'node_modules/cache-manager',
    'node_modules/@nestjs/common',
    'node_modules/@nestjs/core',
    'node_modules/@prisma/client'
  ];

  const requiredFiles = [
    'package.json',
    'tsconfig.json'
  ];

  let allValid = true;

  // Check required directories
  for (const dir of requiredDirs) {
    const fullPath = path.join(__dirname, '..', dir);
    if (directoryExists(fullPath)) {
      printSuccess(`Found required directory: ${dir}`);
    } else {
      printError(`Missing required directory: ${dir}`);
      allValid = false;
    }
  }

  // Check required files
  for (const file of requiredFiles) {
    const fullPath = path.join(__dirname, '..', file);
    if (fileExists(fullPath)) {
      printSuccess(`Found required file: ${file}`);
    } else {
      printError(`Missing required file: ${file}`);
      allValid = false;
    }
  }

  // Check Prisma client
  const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client');
  if (directoryExists(prismaClientPath)) {
    printSuccess('Prisma client generated');

    // Check if key Prisma files exist
    const prismaFiles = ['index.js', 'index.d.ts'];
    for (const file of prismaFiles) {
      const filePath = path.join(prismaClientPath, file);
      if (fileExists(filePath)) {
        printSuccess(`Prisma client file found: ${file}`);
      } else {
        printWarning(`Prisma client file missing: ${file}`);
        allValid = false;
      }
    }
  } else {
    printError('Prisma client not generated');
    allValid = false;
  }

  // Check package.json consistency
  const packageJsonPath = path.join(__dirname, '../package.json');
  if (fileExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check if cache-manager dependencies are declared
      if (packageJson.dependencies && packageJson.dependencies['cache-manager']) {
        printSuccess('cache-manager dependency declared in package.json');
      } else {
        printError('cache-manager dependency missing from package.json');
        allValid = false;
      }

      if (packageJson.dependencies && packageJson.dependencies['@nestjs/cache-manager']) {
        printSuccess('@nestjs/cache-manager dependency declared in package.json');
      } else {
        printError('@nestjs/cache-manager dependency missing from package.json');
        allValid = false;
      }

      if (packageJson.dependencies && packageJson.dependencies['@prisma/client']) {
        printSuccess('@prisma/client dependency declared in package.json');
      } else {
        printError('@prisma/client dependency missing from package.json');
        allValid = false;
      }
    } catch (error) {
      printError(`Error reading package.json: ${error.message}`);
      allValid = false;
    }
  }

  return allValid;
}

function suggestSolutions(validationFailed) {
  if (!validationFailed) return;

  print('\n');
  printWarning('Suggested solutions:');
  print('\n');

  print('cyan', '1. Install missing dependencies:');
  print('reset', '   npm install');
  print('\n');

  print('cyan', '2. Generate Prisma client:');
  print('reset', '   npm run prisma:generate');
  print('\n');

  print('cyan', '3. Clean and reinstall everything:');
  print('reset', '   npm run cache:clear');
  print('reset', '   rm -rf node_modules package-lock.json');
  print('reset', '   npm install');
  print('\n');

  print('cyan', '4. Verify installation:');
  print('reset', '   node scripts/validate-build.js');
  print('\n');
}

function main() {
  printInfo('🔍 Build Validation Started');
  print('=====================================');

  const isValid = validateDependencies();

  print('=====================================');

  if (isValid) {
    printSuccess('🎉 All validations passed! Ready to build.');
    process.exit(0);
  } else {
    printError('🚫 Validation failed. Please resolve the issues above.');
    suggestSolutions(true);
    process.exit(1);
  }
}

// Run the validation
main();