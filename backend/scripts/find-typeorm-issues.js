const fs = require('fs');
const path = require('path');

// Search for all TypeORM imports and references
const typeOrmPatterns = [
  /@InjectRepository\(\s*[\w\s]+\)\s*/g,
  /Repository<[\w\s,]+>/g,
  /from\s+['"]typeorm['"];?\s*\n/g,
  /\.save\(/g,
  /\.findOne\(/g,
  /\.find\(/g,
  /\.createQueryBuilder\(/g,
  /\.update\(/g,
  /\.increment\(/g,
  /\.decrement\(/g,
  /\.remove\(/g,
  /\.softRemove\(/g,
  /\.recover\(/g,
  /TypeOrmModule\.forFeature/g,
  /@Entity\(/g,
  /@Column\(/g,
  /@PrimaryGeneratedColumn\(/g,
  /@CreateDateColumn\(/g,
  /@UpdateDateColumn\(/g,
];

const prismaPatterns = {
  save: /(\w+)\.save\(([^)]+)\)/g,
  findOne: /(\w+)\.findOne\(([^)]+)\)/g,
  find: /(\w+)\.find\(([^)]+)\)/g,
  update: /(\w+)\.update\(([^)]+)\)/g,
  remove: /(\w+)\.remove\(([^)]+)\)/g,
};

const directoryPath = process.argv[2] || './src';

function findFiles(dir, extensions = ['.ts'], exclude = []) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !exclude.includes(item)) {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function searchInFiles(files) {
  const issues = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of typeOrmPatterns) {
          if (pattern.test(line)) {
            issues.push({
              file,
              line: i + 1,
              content: line.trim(),
              pattern: pattern.source
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }

  return issues;
}

function main() {
  console.log('Searching for TypeORM references...');

  const excludeDirs = ['node_modules', 'dist', '.git'];
  const files = findFiles(directoryPath, ['.ts'], excludeDirs);

  console.log(`Found ${files.length} TypeScript files`);

  const issues = searchInFiles(files);

  if (issues.length === 0) {
    console.log('No TypeORM references found!');
    return;
  }

  console.log(`\nFound ${issues.length} TypeORM references:`);
  console.log('=====================================');

  const fileGroups = {};
  issues.forEach(issue => {
    if (!fileGroups[issue.file]) {
      fileGroups[issue.file] = [];
    }
    fileGroups[issue.file].push(issue);
  });

  for (const [file, fileIssues] of Object.entries(fileGroups)) {
    console.log(`\n${file} (${fileIssues.length} issues):`);
    for (const issue of fileIssues) {
      console.log(`  Line ${issue.line}: ${issue.content}`);
      console.log(`    Pattern: ${issue.pattern}`);
    }
  }

  // Generate summary report
  console.log('\n\nSUMMARY:');
  console.log(`Files with issues: ${Object.keys(fileGroups).length}`);
  console.log(`Total TypeORM references: ${issues.length}`);

  console.log('\nFiles that need attention:');
  Object.keys(fileGroups).forEach(file => {
    console.log(`  - ${file}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { findFiles, searchInFiles };