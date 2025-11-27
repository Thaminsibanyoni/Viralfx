import { PrismaClient } from '@prisma/client';
import { program } from 'commander';

const prisma = new PrismaClient();

interface InvoiceOptions {
  customerId: string;
  customerType: 'USER' | 'BROKER';
  month?: number;
  year?: number;
}

async function generateApiInvoice(options: InvoiceOptions) {
  console.log('🧾 Generating API Marketplace invoice...');

  try {
    const now = new Date();
    const month = options.month ?? now.getMonth();
    const year = options.year ?? now.getFullYear();

    // Calculate billing period
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);

    console.log(`📊 Customer: ${options.customerType} ${options.customerId}`);
    console.log(`📅 Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // Check if customer has API keys
    const where = options.customerType === 'USER'
      ? { userId: options.customerId, revoked: false }
      : { brokerId: options.customerId, revoked: false };

    const apiKeys = await prisma.apiKey.findMany({
      where,
      include: {
        plan: {
          include: { product: true },
        },
      },
    });

    if (apiKeys.length === 0) {
      console.log('❌ No active API keys found for this customer');
      return;
    }

    // Calculate monthly fees
    let subtotal = 0;
    const lineItems = [];

    for (const key of apiKeys) {
      const monthlyFee = Number(key.plan.monthlyFee) || 0;
      if (monthlyFee > 0) {
        lineItems.push({
          description: `${key.plan.name} Plan - ${key.plan.product.name}`,
          quantity: 1,
          unitPrice: monthlyFee,
          amount: monthlyFee,
        });
        subtotal += monthlyFee;
      }
    }

    // Add VAT (15%)
    const vatRate = 0.15;
    const vatAmount = subtotal * vatRate;
    const totalAmount = subtotal + vatAmount;

    console.log(`\n💰 Invoice Summary:`);
    console.log(`  Subtotal: R${subtotal.toLocaleString()}`);
    console.log(`  VAT (15%): R${vatAmount.toLocaleString()}`);
    console.log(`  Total: R${totalAmount.toLocaleString()}`);

    // Create invoice record
    const invoice = await prisma.apiInvoice.create({
      data: {
        customerId: options.customerId,
        customerType: options.customerType,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        amountDue: totalAmount,
        amountPaid: 0,
        currency: 'ZAR',
        status: 'PENDING',
        metadata: {
          lineItems,
          subtotal,
          vatAmount,
          vatRate,
          generatedBy: 'script',
        },
      },
    });

    console.log(`\n✅ Invoice created: ${invoice.id}`);
    console.log(`📧 Customer should receive an email notification`);

  } catch (error) {
    console.error('❌ Error generating invoice:', error);
    throw error;
  }
}

// CLI configuration
program
  .name('generate-api-invoice')
  .description('Generate an API Marketplace invoice for a customer')
  .requiredOption('-c, --customer-id <id>', 'Customer ID')
  .requiredOption('-t, --customer-type <type>', 'Customer type (USER or BROKER)')
  .option('-m, --month <number>', 'Billing month (1-12)', new Date().getMonth() + 1)
  .option('-y, --year <number>', 'Billing year', new Date().getFullYear())
  .action((options) => {
    generateApiInvoice(options);
  });

// Run if called directly
if (require.main === module) {
  program.parse();
}

export { generateApiInvoice };