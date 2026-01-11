const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'src/modules');

function fixDuplicateSuper(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix duplicate super() calls
  const fixed = content.replace(
    /super\(\);\s*super\(\);/g,
    'super();'
  );

  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed);
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.processor.ts') && !file.includes('.bak')) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent.includes('super();\nsuper();')) {
        fixDuplicateSuper(filePath);
      }
    }
  }
}

walkDir(modulesDir);
console.log('Done fixing duplicate super() calls!');
