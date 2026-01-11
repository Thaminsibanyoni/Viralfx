const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'src/modules');

function fixProcessorFile(filePath) {
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Fix imports - replace Process with WorkerHost
  content = content.replace(
    /import\s*{\s*([^}]*?)Processor\s*,\s*Process\s*([^}]*?)}\s*from\s*'@nestjs\/bullmq'/g,
    "import {$1Processor, WorkerHost$2} from '@nestjs/bullmq'"
  );
  content = content.replace(
    /import\s*{\s*Processor\s*,\s*Process\s*,([^}]+)}\s*from\s*'@nestjs\/bullmq'/g,
    "import { Processor, WorkerHost,$1} from '@nestjs/bullmq'"
  );
  content = content.replace(
    /import\s*{\s*([^}]*?)Processor\s*,([^}]*?)Process\s*,([^}]*?)}\s*from\s*'@nestjs\/bullmq'/g,
    "import { $1Processor,$2WorkerHost,$3} from '@nestjs/bullmq'"
  );

  // 2. Fix bullmq imports for OnQueue decorators
  content = content.replace(
    /import\s*{\s*Process,\s*OnQueueActive,\s*OnQueueCompleted,\s*OnQueueFailed\s*}\s*from\s*'bullmq'/g,
    "import { OnWorkerEvent } from '@nestjs/bullmq'"
  );

  // 3. Make class extend WorkerHost
  content = content.replace(
    /export class (\w+) extends WorkerHost/g,
    'export class $1 extends WorkerHost'
  );
  content = content.replace(
    /export class (\w+) \{/,
    'export class $1 extends WorkerHost {'
  );

  // 4. Add super() to constructor
  content = content.replace(
    /constructor\s*\(([^)]*)\)\s*\{\s*/g,
    'constructor($1) {\n    super();\n'
  );

  // 5. Collect @Process decorators and convert to process method
  const processRegex = /@Process\(['"]([^'"]+)['"]\)\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)/g;
  let match;
  const processes = [];
  while ((match = processRegex.exec(content)) !== null) {
    processes.push({
      jobName: match[1],
      methodName: match[2],
      fullMatch: match[0]
    });
  }

  // 6. Convert @Process decorators to private methods
  for (const proc of processes) {
    // Remove the @Process decorator
    content = content.replace(
      new RegExp(`@Process\\(['"]${proc.jobName}['"]\\)\\s*`, 'g'),
      'private async '
    );
  }

  // 7. Fix OnQueue decorators to OnWorkerEvent
  content = content.replace(/@OnQueueActive\(\)\s*/g, "@OnWorkerEvent('active')\n  ");
  content = content.replace(/@OnQueueCompleted\(\)\s*/g, "@OnWorkerEvent('completed')\n  ");
  content = content.replace(/@OnQueueFailed\(\)\s*/g, "@OnWorkerEvent('failed')\n  ");

  // 8. Add process() method after constructor
  if (processes.length > 0) {
    const constructorEndRegex = /constructor\s*\([^)]*\)\s*\{\s*super\(\);?\s*\}/;
    const constructorMatch = content.match(constructorEndRegex);
    
    if (constructorMatch) {
      const insertPos = content.indexOf(constructorMatch[0]) + constructorMatch[0].length;
      
      let processMethod = '\n\n  async process(job: any): Promise<any> {\n';
      processMethod += '    switch (job.name) {\n';
      for (const proc of processes) {
        processMethod += `      case '${proc.jobName}':\n`;
        processMethod += `        return this.${proc.methodName}(job);\n`;
      }
      processMethod += '      default:\n';
      processMethod += "        throw new Error(`Unknown job name: ${job.name}`);\n";
      processMethod += '    }\n';
      processMethod += '  }\n';
      
      content = content.slice(0, insertPos) + processMethod + content.slice(insertPos);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`  Fixed ${processes.length} job handlers`);
  } else {
    console.log('  No changes needed');
  }
}

// Find and fix all processor files
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.processor.ts') && !file.includes('.bak')) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent.includes('@Process')) {
        fixProcessorFile(filePath);
      }
    }
  }
}

walkDir(modulesDir);
console.log('\nDone!');
