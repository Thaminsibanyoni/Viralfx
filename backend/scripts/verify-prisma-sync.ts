#!/usr/bin/env ts-node

/**
 * Prisma Client Sync Verification Script
 *
 * This script checks if the Prisma Client is in sync with the schema.
 * It detects common issues that cause the "white page" problem.
 *
 * Usage: npm run prisma:verify
 * Exit codes: 0 = success, 1 = sync issues detected
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  modelsFound: number;
  schemaModels: string[];
}

async function verifyPrismaSync(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    modelsFound: 0,
    schemaModels: []
  };

  try {
    // 1. Try to import Prisma Client
    let PrismaClient: any;
    try {
      PrismaClient = require('@prisma/client').PrismaClient;
    } catch (importError) {
      result.success = false;
      result.errors.push(
        '❌ Cannot import @prisma/client. Run "npm run prisma:generate" first.'
      );
      return result;
    }

    // 2. Try to instantiate PrismaClient (checks basic sync)
    let prisma: any;
    try {
      prisma = new PrismaClient();
    } catch (clientError) {
      result.success = false;
      result.errors.push(
        `❌ Failed to instantiate PrismaClient: ${clientError.message}\n` +
        '   This usually indicates the client is out of sync with the schema.'
      );
      return result;
    }

    // 3. Extract model names from schema.prisma
    const schemaPath = join(__dirname, '../prisma/schema.prisma');
    let schemaContent: string;

    try {
      schemaContent = readFileSync(schemaPath, 'utf8');
    } catch (schemaError) {
      result.success = false;
      result.errors.push(
        `❌ Cannot read schema file: ${schemaPath}\n` +
        '   Ensure the schema file exists and is accessible.'
      );
      return result;
    }

    // Extract model names using regex
    const modelRegex = /^model\s+(\w+)\s*\{/gm;
    const matches = schemaContent.match(modelRegex);
    const schemaModels = matches ? matches.map(match => match.replace(/^model\s+(\w+)\s*\{/, '$1')) : [];

    result.schemaModels = schemaModels;

    // 4. Get available models from Prisma Client
    const clientModelNames = Object.keys(prisma).filter(
      key => typeof prisma[key] === 'object' &&
             prisma[key] !== null &&
             !key.startsWith('_') &&
             key !== 'constructor' &&
             key !== '$connect' &&
             key !== '$disconnect' &&
             key !== '$on' &&
             key !== '$transaction' &&
             key !== '$use' &&
             key !== '$queryRaw' &&
             key !== '$executeRaw' &&
             key !== '$queryRawUnsafe' &&
             key !== '$executeRawUnsafe'
    );

    result.modelsFound = clientModelNames.length;

    // 5. Enhanced model comparison between schema and client
    const normalizedSchemaModels = schemaModels.map(model => model.toLowerCase());
    const normalizedClientModels = clientModelNames.map(model => model.toLowerCase());

    // Find models in schema but not in client
    const missingFromClient = schemaModels.filter(
      schemaModel => !normalizedClientModels.includes(schemaModel.toLowerCase())
    );

    // Find models in client but not in schema
    const extraInClient = clientModelNames.filter(
      clientModel => !normalizedSchemaModels.includes(clientModel.toLowerCase())
    );

    // Report mismatches
    if (missingFromClient.length > 0) {
      result.errors.push(
        '❌ Models found in schema but missing from Prisma Client:\n' +
        `   ${missingFromClient.join(', ')}\n` +
        '   This indicates the client is out of sync with the schema.\n' +
        '   Run "npm run prisma:generate" to regenerate the client.'
      );
      result.success = false;
    }

    if (extraInClient.length > 0) {
      result.warnings.push(
        '⚠️  Models found in Prisma Client but not in schema:\n' +
        `   ${extraInClient.join(', ')}\n` +
        '   This might indicate stale client models or schema inconsistencies.'
      );
    }

    // 6. Check for specific known issues by parsing schema content directly

    // Check User model structure by parsing schema
    const userModelMatch = schemaContent.match(/model\s+User\s*\{([\s\S]*?)\n\}/);
    if (userModelMatch) {
      const userModelContent = userModelMatch[1];
      const hasVpmxBets = userModelContent.includes('vpmxBets');
      const hasVpmxBetsLegacy = userModelContent.includes('vpmxBetsLegacy');

      if (hasVpmxBets && hasVpmxBetsLegacy) {
        // Good - both fields exist
      } else if (hasVpmxBets) {
        result.warnings.push('⚠️  User schema has vpmxBets but missing vpmxBetsLegacy');
      } else if (hasVpmxBetsLegacy) {
        result.warnings.push('⚠️  User schema has vpmxBetsLegacy but missing vpmxBets');
      }
    }

    // Check BrokerSubscription model for ApiUsage (not ApiUsageRecord) by parsing schema
    const brokerSubModelMatch = schemaContent.match(/model\s+BrokerSubscription\s*\{([\s\S]*?)\n\}/);
    if (brokerSubModelMatch) {
      const brokerSubContent = brokerSubModelMatch[1];
      if (brokerSubContent.includes('apiUsageRecords')) {
        result.errors.push(
          '❌ BrokerSubscription schema still references "apiUsageRecords" field.\n' +
          '   This should be "apiUsage" (singular) to match the corrected schema.\n' +
          '   Update the schema and run "npm run prisma:generate".'
        );
        result.success = false;
      }
    }

    // 7. Basic connection test (optional - don't require database to be running)
    try {
      // Just test that we can access the Prisma Client metadata
      const datamodel = prisma._engine?.datamodel || prisma._engineDataModel;
      if (!datamodel) {
        result.warnings.push('⚠️  Prisma Client metadata not available, but basic sync seems OK');
      }
    } catch (metadataError) {
      result.warnings.push(`⚠️  Cannot access Prisma Client metadata: ${metadataError.message}`);
    }

    // 7. Clean up
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      // Don't fail for disconnect errors
    }

  } catch (unexpectedError) {
    result.success = false;
    result.errors.push(
      `❌ Unexpected error during verification: ${unexpectedError.message}\n` +
      `   Stack: ${unexpectedError.stack}`
    );
  }

  return result;
}

async function main() {
  console.log('🔍 Verifying Prisma Client sync with schema...\n');

  const result = await verifyPrismaSync();

  // Output results
  if (result.errors.length > 0) {
    console.log('❌ PRISMA SYNC ISSUES DETECTED:\n');
    result.errors.forEach(error => console.log(error));
    console.log('\n💡 Recommended fix:');
    console.log('   cd backend && npm run prisma:generate');
  } else {
    console.log('✅ Prisma client appears to be in sync with schema');
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    result.warnings.forEach(warning => console.log(warning));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   - Models found in client: ${result.modelsFound}`);
  console.log(`   - Models defined in schema: ${result.schemaModels.length}`);

  if (result.modelsFound > 0) {
    console.log(`   - Sync status: ${result.success ? 'GOOD' : 'NEEDS ATTENTION'}`);
  }

  // Show detailed model comparison if there are mismatches
  try {
    // Create a temporary Prisma Client instance for comparison
    const tempPrisma = new (require('@prisma/client').PrismaClient)();
    const clientModelNames = Object.keys(tempPrisma).filter(
      key => typeof tempPrisma[key] === 'object' &&
             tempPrisma[key] !== null &&
             !key.startsWith('_') &&
             key !== 'constructor' &&
             key !== '$connect' &&
             key !== '$disconnect' &&
             key !== '$on' &&
             key !== '$transaction' &&
             key !== '$use' &&
             key !== '$queryRaw' &&
             key !== '$executeRaw' &&
             key !== '$queryRawUnsafe' &&
             key !== '$executeRawUnsafe'
    );

    const missingFromClient = result.schemaModels.filter(
      schemaModel => !clientModelNames.includes(schemaModel) && !clientModelNames.includes(schemaModel.toLowerCase())
    );
    const extraInClient = clientModelNames.filter(
      clientModel => !result.schemaModels.includes(clientModel) && !result.schemaModels.includes(clientModel.charAt(0).toUpperCase() + clientModel.slice(1))
    );

    if (missingFromClient.length > 0 || extraInClient.length > 0) {
      console.log(`\n🔍 Model comparison details:`);
      if (missingFromClient.length > 0) {
        console.log(`   - Missing from client: ${missingFromClient.join(', ')}`);
      }
      if (extraInClient.length > 0) {
        console.log(`   - Extra in client: ${extraInClient.join(', ')}`);
      }
    }

    // Clean up temporary client
    await tempPrisma.$disconnect().catch(() => {});
  } catch (error) {
    // Don't fail the script if we can't create detailed comparison
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Verification script failed:', error.message);
    process.exit(1);
  });
}

export { verifyPrismaSync };