#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Prisma Schema and Entity Consistency...\n');

// Read Prisma schema
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Extract models from Prisma schema
const modelMatches = schemaContent.match(/^model\s+(\w+)\s+\{/gm);
const prismaModels = modelMatches ? modelMatches.map(match => match.split(' ')[1]) : [];

console.log(`📊 Found ${prismaModels.length} models in Prisma schema:`);
console.log(prismaModels.map(model => `  - ${model}`).join('\n'));

// Get all entity files
const entitiesDir = path.join(__dirname, '../src/database/entities');
const entityFiles = fs.readdirSync(entitiesDir)
  .filter(file => file.endsWith('.entity.ts'))
  .map(file => file.replace('.entity.ts', ''));

console.log(`\n📁 Found ${entityFiles.length} entity files:`);
console.log(entityFiles.map(entity => `  - ${entity}`).join('\n'));

// Check for entities in modules
const modulesDir = path.join(__dirname, '../src/modules');
const moduleEntities = [];

function findEntityFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      findEntityFiles(itemPath);
    } else if (item.endsWith('.entity.ts')) {
      const relativePath = path.relative(modulesDir, itemPath);
      moduleEntities.push(relativePath);
    }
  }
}

findEntityFiles(modulesDir);

console.log(`\n📦 Found ${moduleEntities.length} module entities:`);
console.log(moduleEntities.map(entity => `  - ${entity}`).join('\n'));

// Check for missing entities
console.log('\n🔍 Checking for missing entities...');

const missingEntities = [];
prismaModels.forEach(model => {
  const entityName = model.toLowerCase().replace(/([A-Z])/g, '-$1').slice(1);
  const camelCaseEntity = model.charAt(0).toLowerCase() + model.slice(1);

  const hasMainEntity = entityFiles.includes(entityName) || entityFiles.includes(camelCaseEntity);
  const hasModuleEntity = moduleEntities.some(entity => entity.includes(entityName.toLowerCase()));

  if (!hasMainEntity && !hasModuleEntity) {
    missingEntities.push({
      model: model,
      entityName: entityName,
      camelCase: camelCaseEntity
    });
  }
});

if (missingEntities.length > 0) {
  console.log('\n❌ Missing entities for these Prisma models:');
  missingEntities.forEach(({ model, entityName, camelCase }) => {
    console.log(`  - ${model} (${entityName}.entity.ts or ${camelCase}.entity.ts)`);
  });
} else {
  console.log('\n✅ All Prisma models have corresponding entities!');
}

// Check for orphaned entities
const orphanedEntities = entityFiles.filter(entity => {
  const camelCase = entity.charAt(0).toUpperCase() + entity.slice(1);
  return !prismaModels.includes(camelCase);
});

if (orphanedEntities.length > 0) {
  console.log('\n⚠️  Entities without corresponding Prisma models:');
  orphanedEntities.forEach(entity => {
    console.log(`  - ${entity}.entity.ts`);
  });
}

// Check for relationship consistency
console.log('\n🔗 Checking entity relationships...');

// Common issues to check
const issues = [];

entityFiles.forEach(entityFile => {
  const filePath = path.join(entitiesDir, `${entityFile}.entity.ts`);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for circular import patterns
    if (content.includes('../../database/entities/')) {
      issues.push(`Potential circular import in ${entityFile}.entity.ts`);
    }

    // Check for missing imports
    if (content.includes('@ManyToOne(() => User') && !content.includes("import { User }")) {
      issues.push(`Missing User import in ${entityFile}.entity.ts`);
    }
  }
});

if (issues.length > 0) {
  console.log('\n⚠️  Potential issues found:');
  issues.forEach(issue => {
    console.log(`  - ${issue}`);
  });
} else {
  console.log('\n✅ No obvious import/relationship issues found!');
}

// Summary
console.log('\n📋 Summary:');
console.log(`  - Prisma Models: ${prismaModels.length}`);
console.log(`  - Database Entities: ${entityFiles.length}`);
console.log(`  - Module Entities: ${moduleEntities.length}`);
console.log(`  - Missing Entities: ${missingEntities.length}`);
console.log(`  - Orphaned Entities: ${orphanedEntities.length}`);
console.log(`  - Issues Found: ${issues.length}`);

if (missingEntities.length === 0 && issues.length === 0) {
  console.log('\n🎉 Prisma schema and entities are consistent!');
} else {
  console.log('\n⚠️  Some issues found. Please review and fix.');
}