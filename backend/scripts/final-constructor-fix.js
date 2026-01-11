#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Find all TypeScript files
function findTsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Fix constructor syntax issues completely
function fixConstructorComplete(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Find constructor and fix it completely
  const constructorMatch = content.match(/constructor\s*\(([^)]*)\)/s);
  if (constructorMatch) {
    let params = constructorMatch[1];

    // Check if there are issues
    if (params.includes('private readonly prisma: PrismaService') && !params.includes(',')) {
      console.log(`Fixing constructor in: ${filePath}`);

      // Extract all parameters, clean them up
      const allParams = params.split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('//'))
        .map(p => p.replace(/,$/, '')) // Remove trailing commas
        .filter(p => p.includes('private') || p.includes('public') || p.includes('protected') || p.includes('@'));

      // Remove duplicates of PrismaService
      const uniqueParams = [];
      let hasPrisma = false;

      for (const param of allParams) {
        if (param.includes('PrismaService')) {
          if (!hasPrisma) {
            uniqueParams.push(param);
            hasPrisma = true;
          }
        } else {
          uniqueParams.push(param);
        }
      }

      // Rebuild constructor with proper commas
      const newParams = uniqueParams.join(',\n    ');
      const newConstructor = `constructor(\n    ${newParams}\n  )`;

      content = content.replace(constructorMatch[0], newConstructor);

      fs.writeFileSync(filePath, content);
      modified = true;

      if (modified) {
        console.log(`  ✓ Fixed constructor in ${filePath}`);
      }
    }
  }

  return modified;
}

// Process all files
console.log('🔧 Final constructor fix...');
const tsFiles = findTsFiles(srcDir);
let fixedCount = 0;

for (const file of tsFiles) {
  if (fixConstructorComplete(file)) {
    fixedCount++;
  }
}

console.log(`\n✅ Completed! Fixed ${fixedCount} files.`);