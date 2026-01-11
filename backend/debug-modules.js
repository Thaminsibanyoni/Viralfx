#!/usr/bin/env node

/**
 * Deep Debug Script for NestJS Module Loading
 * This script helps identify which module is causing the decorator error
 */

const modules = [
  { name: 'ConfigModule', path: './dist/modules/config/config.module.js' },
  { name: 'RedisModule', path: './dist/modules/redis/redis.module.js' },
  { name: 'StorageModule', path: './dist/modules/storage/storage.module.js' },
  { name: 'WebSocketModule', path: './dist/modules/websocket/websocket.module.js' },
  { name: 'OrderMatchingModule', path: './dist/modules/order-matching/order-matching.module.js' },
  { name: 'WalletModule', path: './dist/modules/wallet/wallet.module.js' },
  { name: 'PaymentModule', path: './dist/modules/payment/payment.module.js' },
  { name: 'MarketAggregationModule', path: './dist/modules/market-aggregation/market-aggregation.module.js' },
  { name: 'AuthModule', path: './dist/modules/auth/auth.module.js' },
  { name: 'UsersModule', path: './dist/modules/users/users.module.js' },
  { name: 'TopicsModule', path: './dist/modules/topics/topics.module.js' },
  { name: 'IngestModule', path: './dist/modules/ingest/ingest.module.js' },
  { name: 'SentimentModule', path: './dist/modules/sentiment/sentiment.module.js' },
  { name: 'DeceptionModule', path: './dist/modules/deception/deception.module.js' },
  { name: 'ViralModule', path: './dist/modules/viral/viral.module.js' },
  { name: 'TrendMLModule', path: './dist/modules/trend-ml/trend-ml.module.js' },
  { name: 'MarketsModule', path: './dist/modules/markets/markets.module.js' },
  { name: 'ChatModule', path: './dist/modules/chat/chat.module.js' },
  { name: 'NotificationsModule', path: './dist/modules/notifications/notifications.module.js' },
  { name: 'FilesModule', path: './dist/modules/files/files.module.js' },
  { name: 'AdminModule', path: './dist/modules/admin/admin.module.js' },
  { name: 'OracleModule', path: './dist/modules/oracle/oracle.module.js' },
  { name: 'BrokersModule', path: './dist/modules/brokers/brokers.module.js' },
  { name: 'CrmModule', path: './dist/modules/crm/crm.module.js' },
  { name: 'FinancialReportingModule', path: './dist/modules/financial-reporting/financial-reporting.module.js' },
  { name: 'SupportModule', path: './dist/modules/support/support.module.js' },
  { name: 'AnalyticsModule', path: './dist/modules/analytics/analytics.module.js' },
  { name: 'ReferralModule', path: './dist/modules/referral/referral.module.js' },
  { name: 'ApiMarketplaceModule', path: './dist/modules/api-marketplace/api-marketplace.module.js' },
  { name: 'VPMXModule', path: './dist/modules/vpmx/vpmx.module.js' },
];

console.log('🔍 Deep Debug: Testing module loading...\n');

async function testModule(module, index) {
  try {
    console.log(`[${index + 1}/${modules.length}] Testing ${module.name}...`);
    require(module.path);
    console.log(`✅ ${module.name} - OK`);
    return true;
  } catch (error) {
    console.error(`❌ ${module.name} - FAILED`);
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    return false;
  }
}

async function debugModules() {
  let failedAt = null;

  for (let i = 0; i < modules.length; i++) {
    const success = await testModule(modules[i], i);
    if (!success && !failedAt) {
      failedAt = modules[i];
      break;
    }
  }

  if (failedAt) {
    console.log(`\n🎯 FIRST FAILED MODULE: ${failedAt.name}`);
    console.log(`   Path: ${failedAt.path}`);
    console.log('\n💡 Next: Check this module for:');
    console.log('   - Missing @Injectable() decorators');
    console.log('   - Circular dependencies');
    console.log('   - Missing exports');
    console.log('   - Abstract classes as providers');
  } else {
    console.log('\n✅ All modules loaded successfully!');
  }
}

debugModules().catch(console.error);
