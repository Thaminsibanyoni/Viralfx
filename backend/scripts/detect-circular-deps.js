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

// Extract imports from a file
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];

  // Match import statements
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Only include relative imports
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      imports.push(importPath);
    }
  }

  return imports;
}

// Get the module name from a file path
function getModuleName(filePath) {
  const relativePath = path.relative(srcDir, filePath);
  const parts = relativePath.split(path.sep);
  return parts[0]; // modules/viral -> viral
}

// Main detection logic
function detectCircularDependencies() {
  console.log('🔍 Detecting potential circular dependencies...');

  const tsFiles = findTsFiles(srcDir);
  const moduleDeps = new Map();

  // Build module dependency graph
  for (const file of tsFiles) {
    const moduleName = getModuleName(file);
    if (!moduleName || !file.includes('/modules/')) continue;

    const imports = extractImports(file);
    const dependentModules = new Set();

    for (const importPath of imports) {
      // Resolve the import path to a module
      const resolvedPath = path.resolve(path.dirname(file), importPath);
      const normalizedPath = path.relative(srcDir, resolvedPath);

      if (normalizedPath.includes('/modules/')) {
        const parts = normalizedPath.split(path.sep);
        const importedModule = parts[0];

        if (importedModule !== moduleName) {
          dependentModules.add(importedModule);
        }
      }
    }

    if (dependentModules.size > 0) {
      if (!moduleDeps.has(moduleName)) {
        moduleDeps.set(moduleName, new Set());
      }
      dependentModules.forEach(dep => moduleDeps.get(moduleName).add(dep));
    }
  }

  // Check for circular dependencies
  console.log('\n📊 Module Dependencies:');
  for (const [module, deps] of moduleDeps.entries()) {
    console.log(`${module}: [${Array.from(deps).join(', ')}]`);
  }

  // Simple circular dependency detection
  console.log('\n🔴 Potential Circular Dependencies:');
  for (const [moduleA, depsA] of moduleDeps.entries()) {
    for (const moduleB of depsA) {
      if (moduleDeps.has(moduleB) && moduleDeps.get(moduleB).has(moduleA)) {
        console.log(`  ${moduleA} ↔ ${moduleB}`);
      }
    }
  }
}

detectCircularDependencies();