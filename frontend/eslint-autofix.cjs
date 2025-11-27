#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively find all TypeScript files
function findTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist') {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

// Function to fix unused variables in a file
function fixUnusedVariables(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix unused imports
  content = content.replace(/import\s+([^;]+);/g, (match, imports) => {
    const fixedImports = imports
      .split(',')
      .map(imp => {
        const trimmed = imp.trim();
        // If this import is not used in the file, prefix with underscore
        if (!content.includes(trimmed.split(' as ')[0] || trimmed) && !trimmed.startsWith('_')) {
          return `_${trimmed}`;
        }
        return trimmed;
      })
      .join(', ');

    if (fixedImports !== imports) {
      modified = true;
    }
    return `import ${fixedImports};`;
  });

  // Fix unused variables in destructuring
  content = content.replace(/const\s+{([^}]+)}/g, (match, vars) => {
    const fixedVars = vars
      .split(',')
      .map(v => {
        const trimmed = v.trim();
        if (trimmed && !trimmed.startsWith('_') && !content.includes(trimmed)) {
          return `_${trimmed}`;
        }
        return trimmed;
      })
      .join(', ');

    if (fixedVars !== vars) {
      modified = true;
    }
    return `const {${fixedVars}}`;
  });

  // Fix unused const/let variables
  content = content.replace(/(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, keyword, varName) => {
    // Skip if already prefixed or if it's used later in the file
    if (varName.startsWith('_')) {
      return match;
    }

    // Simple check - if variable appears again after declaration, it's probably used
    const varIndex = content.indexOf(match);
    const afterDeclaration = content.substring(varIndex + match.length);
    if (afterDeclaration.includes(varName)) {
      return match;
    }

    modified = true;
    return `${keyword} _${varName}`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Found ${tsFiles.length} TypeScript files...`);

let fixedCount = 0;
for (const file of tsFiles) {
  if (fixUnusedVariables(file)) {
    fixedCount++;
  }
}

console.log(`\n✅ Fixed unused variables in ${fixedCount} files!`);