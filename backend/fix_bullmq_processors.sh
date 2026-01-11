#!/bin/bash
# Script to fix BullMQ processors to use WorkerHost pattern

set -e

cd "$(dirname "$0")/src/modules"

# Find all processor files that have @Process decorator
echo "Finding processor files with @Process decorator..."

# Use grep to find files, then process each
grep -rl "@Process" --include="*.processor.ts" . | while read -r file; do
  echo "Processing: $file"

  # Backup file
  cp "$file" "$file.bak"

  # 1. Change import: replace Process with WorkerHost
  sed -i "s/import { Processor, Process } from '@nestjs\/bullmq';/import { Processor, WorkerHost } from '@nestjs\/bullmq';/g" "$file"

  # 2. Change import patterns with more decorators
  sed -i "s/import { Processor, Process, /import { Processor, WorkerHost, /g" "$file"
  sed -i "s/import { \(.*\)Processor, \(.*\)Process, \(.*\) } from '@nestjs\/bullmq';/import { \1Processor, \2WorkerHost, \3 } from '@nestjs\/bullmq';/g" "$file"

  # 3. Change class to extend WorkerHost
  sed -i "s/export class \([A-Za-z0-9_]*\) {$/export class \1 extends WorkerHost {/g" "$file"

  # 4. Add super() to constructor (simple heuristic - add after constructor opening)
  # This is tricky with sed, so we'll use a more careful approach

  # 5. Remove @Process decorators and make methods private
  # First, capture the job name from @Process('job-name') and remove the decorator
  # Then make the method private

  sed -i "s/@Process('\([^']*\)')/\/\/ @Process('\1') - HANDLED IN process()/g" "$file"
  sed -i "s/@Process(\"[^\"]*\")/\/\/ @Process - HANDLED IN process()/g" "$file"

  # Change public methods with @Process comments to private
  # This is a simplified approach - may need manual adjustment

  # Fix OnQueue decorators to OnWorkerEvent
  sed -i "s/@OnQueueActive()/@OnWorkerEvent('active')/g" "$file"
  sed -i "s/@OnQueueCompleted()/@OnWorkerEvent('completed')/g" "$file"
  sed -i "s/@OnQueueFailed()/@OnWorkerEvent('failed')/g" "$file"

  echo "  Basic fixes applied - manual review required for process() method"
done

echo ""
echo "Done! Note: This script only applies basic fixes."
echo "You will need to manually add the process() method to each processor."
echo ""
echo "For each processor, add a method like:"
echo "  async process(job: Job): Promise<any> {"
echo "    switch (job.name) {"
echo "      case 'job-name-1': return this.handler1(job);"
echo "      case 'job-name-2': return this.handler2(job);"
echo "      default: throw new Error(\`Unknown job name: \${job.name}\`);"
echo "    }"
echo "  }"
