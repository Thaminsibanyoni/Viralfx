import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetApiQuotas() {
  console.log('🔄 Resetting API key quotas...');

  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Reset all API keys that need quota reset
    const result = await prisma.apiKey.updateMany({
      where: {
        quotaResetAt: {
          lt: now,
        },
      },
      data: {
        usageCount: 0,
        quotaResetAt: nextMonth,
      },
    });

    console.log(`✅ Reset quotas for ${result.count} API keys`);
    console.log(`📅 Next reset date: ${nextMonth.toISOString()}`);

  } catch (error) {
    console.error('❌ Error resetting quotas:', error);
    throw error;
  }
}

async function main() {
  await resetApiQuotas();
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}