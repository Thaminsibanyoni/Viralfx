#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');
const CACHE_FILE = path.join(__dirname, '../.prisma-cache.json');

function calculateFileHash(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(fileContent).digest('hex');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(cacheContent);
    }
  } catch (error) {
    console.error(`Error reading cache file:`, error.message);
  }
  return null;
}

function writeCache(hash) {
  try {
    const cacheData = {
      schemaHash: hash,
      lastGenerated: new Date().toISOString(),
      nodeVersion: process.version
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error(`Error writing cache file:`, error.message);
  }
}

function main() {
  // Check if schema file exists
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`Prisma schema file not found: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  // Calculate current schema hash
  const currentHash = calculateFileHash(SCHEMA_FILE);

  // Read cached hash
  const cache = readCache();

  if (cache && cache.schemaHash === currentHash) {
    console.log('✅ Prisma schema unchanged, skipping generation');
    process.exit(0); // Skip generation
  } else {
    console.log('🔄 Prisma schema changed, generation needed');
    // Update cache after successful generation will be handled by the package.json script
    process.exit(1); // Needs generation
  }
}

// If called with --save flag, save the hash
if (process.argv.includes('--save')) {
  const currentHash = calculateFileHash(SCHEMA_FILE);
  writeCache(currentHash);
  console.log('✅ Prisma cache updated');
} else if (require.main === module) {
  main();
}

module.exports = { calculateFileHash, readCache, writeCache };