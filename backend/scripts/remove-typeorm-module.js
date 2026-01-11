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

// Fix a single file
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove TypeOrmModule imports
  if (content.includes('TypeOrmModule')) {
    console.log(`Fixing TypeOrmModule in: ${filePath}`);

    // Remove TypeOrmModule import
    content = content.replace(/import\s*{\s*[^}]*TypeOrmModule[^}]*}\s*from\s*['"]@nestjs\/typeorm['"];?\s*\n?/g, '');

    // Remove TypeOrmModule.forFeature lines
    content = content.replace(/TypeOrmModule\.forFeature\(\[[^\]]*\]\),?\s*\n?/g, '');

    // Replace TypeOrmModule.forRoot with nothing (since Prisma handles this)
    content = content.replace(/TypeOrmModule\.forRoot\([^)]*\),?\s*\n?/g, '');

    fs.writeFileSync(filePath, content);
    modified = true;

    if (modified) {
      console.log(`  ✓ Removed TypeOrmModule from ${filePath}`);
    }
  }

  return modified;
}

// Process all files
console.log('🔧 Removing TypeOrmModule references across the project...');
const tsFiles = findTsFiles(srcDir);
let fixedCount = 0;

for (const file of tsFiles) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\n✅ Completed! Fixed ${fixedCount} files.`);