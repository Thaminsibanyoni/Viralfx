#!/usr/bin/env node

const { calculateFileHash, writeCache } = require('./check-prisma-changes.js');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

function main() {
  try {
    const currentHash = calculateFileHash(SCHEMA_FILE);
    writeCache(currentHash);
    console.log('✅ Prisma cache updated successfully');
  } catch (error) {
    console.error('❌ Error updating Prisma cache:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}