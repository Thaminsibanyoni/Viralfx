#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that need re-exports
const filesToFix = [
  'src/stores/brokerStore.ts',
  'src/hooks/useNotifications.ts',
  'src/types/broker.ts',
  'src/utils/currency.ts',
  'src/services/api/wallet.api.ts',
  'src/services/api/notification.api.ts',
  'src/services/api/admin.api.ts',
  'src/types/differentialSync.ts'
];

function fixExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Find all exports that start with underscore
  const underscoreExports = content.match(/export const _(\w+)/g);

  if (underscoreExports) {
    const reExports = underscoreExports.map(exportLine => {
      const match = exportLine.match(/export const _(\w+)/);
      if (match) {
        const originalName = match[1];
        const underscoreName = `_${originalName}`;
        return `// Re-export with original name for compatibility\nexport const ${originalName} = ${underscoreName};`;
      }
    }).filter(Boolean);

    if (reExports.length > 0) {
      const newContent = content + '\n\n' + reExports.join('\n') + '\n';
      fs.writeFileSync(filePath, newContent);
      console.log(`Fixed exports in: ${filePath}`);
      return true;
    }
  }

  return false;
}

// Fix all files
let fixedCount = 0;
for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    if (fixExports(file)) {
      fixedCount++;
    }
  } else {
    console.log(`File not found: ${file}`);
  }
}

console.log(`\n✅ Fixed exports in ${fixedCount} files!`);