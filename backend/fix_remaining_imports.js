const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'src/modules');

function fixFileImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let modified = false;

  // Fix: Replace Process with WorkerHost in imports
  if (content.includes("import { Processor, Process }")) {
    content = content.replace(
      /import\s*{\s*Processor,\s*Process\s*}\s*from\s*['"]@nestjs\/bullmq['"]/g,
      "import { Processor, WorkerHost } from '@nestjs/bullmq'"
    );
    modified = true;
  }

  // Fix: Replace OnQueue* with OnWorkerEvent in imports
  if (content.includes('@nestjs/bullmq') && (content.includes('OnQueue') || content.includes('@Queue'))) {
    content = content.replace(
      /,\s*OnQueueActive/g,
      ''
    );
    content = content.replace(
      /,\s*OnQueueCompleted/g,
      ''
    );
    content = content.replace(
      /,\s*OnQueueFailed/g,
      ''
    );
    // Add OnWorkerEvent if not present and OnQueue was there
    if (!content.includes('OnWorkerEvent') && (content.includes('OnQueueActive') || content.includes('OnQueueCompleted') || content.includes('OnQueueFailed'))) {
      content = content.replace(
        /from\s+['"]@nestjs\/bullmq['"]/g,
        ", OnWorkerEvent } from '@nestjs/bullmq'"
      );
      // Need to fix the closing brace
      content = content.replace(
        /, OnWorkerEvent } from '@nestjs\/bullmq'/g,
        ", OnWorkerEvent } from '@nestjs/bullmq'"
      );
    }
    modified = true;
  }

  // Fix: Replace OnQueue decorators with @OnWorkerEvent in file content
  const queueEvents = ['OnQueueActive', 'OnQueueCompleted', 'OnQueueFailed', 'OnQueuePaused', 'OnQueueResumed', 'OnQueueStalled'];
  const workerEvents = ['active', 'completed', 'failed', 'paused', 'resumed', 'stalled'];
  
  for (let i = 0; i < queueEvents.length; i++) {
    if (content.includes(`@${queueEvents[i]}()`)) {
      content = content.replace(
        new RegExp(`@${queueEvents[i]}\\(\\)`, 'g'),
        `@OnWorkerEvent('${workerEvents[i]}')`
      );
      modified = true;
    }
  }

  if (modified && content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('.bak') && !filePath.includes('node_modules')) {
      walkDir(filePath);
    } else if (file.endsWith('.processor.ts') && !file.includes('.bak')) {
      fixFileImports(filePath);
    }
  }
}

walkDir(modulesDir);
console.log('Done fixing imports!');
