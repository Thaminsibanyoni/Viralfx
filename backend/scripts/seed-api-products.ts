import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Product definitions with ZAR pricing
const API_PRODUCTS = [
  {
    slug: 'smi-api',
    name: 'Social Mood Index API',
    description: 'Real-time social sentiment scores and analytics for financial markets',
    category: 'SMI',
    defaultPlan: 'starter',
    features: [
      'Real-time sentiment scores',
      'Historical data access',
      'WebSocket streaming',
      'Advanced analytics',
      'Bulk data export',
    ],
    isActive: true,
    plans: [
      {
        code: 'smi-starter',
        name: 'Starter',
        monthlyFee: 890, // ZAR 890 (~$49)
        perCallFee: null,
        rateLimit: 100,
        burstLimit: 150,
        quota: 10000,
        description: 'Perfect for developers getting started with social sentiment analysis',
      },
      {
        code: 'smi-pro',
        name: 'Pro',
        monthlyFee: 8990, // ZAR 8,990 (~$499)
        perCallFee: null,
        rateLimit: 5000,
        burstLimit: 7500,
        quota: 1000000,
        description: 'Professional grade sentiment data for production applications',
      },
      {
        code: 'smi-institutional',
        name: 'Institutional',
        monthlyFee: 89990, // ZAR 89,990 (~$4,999)
        perCallFee: null,
        rateLimit: 30000,
        burstLimit: 45000,
        quota: 10000000,
        description: 'Enterprise-grade access for institutional trading platforms',
      },
    ],
  },
  {
    slug: 'vts-feed',
    name: 'VTS Symbol Feed API',
    description: 'Universal trend symbol data for market momentum tracking',
    category: 'VTS',
    defaultPlan: 'basic',
    features: [
      'Real-time symbol data',
      'Trend strength indicators',
      'Momentum scores',
      'Symbol metadata',
      'API documentation',
    ],
    isActive: true,
    plans: [
      {
        code: 'vts-basic',
        name: 'Basic',
        monthlyFee: 3990, // ZAR 3,990 (~$219)
        perCallFee: null,
        rateLimit: 1000,
        burstLimit: 1500,
        quota: null, // Unlimited
        description: 'Essential VTS symbol data for basic applications',
      },
      {
        code: 'vts-enterprise',
        name: 'Enterprise',
        monthlyFee: null, // Custom pricing
        perCallFee: 0.5, // ZAR 0.50 per call
        rateLimit: 100000,
        burstLimit: 150000,
        quota: null,
        description: 'Custom pricing for high-volume enterprise users',
      },
    ],
  },
  {
    slug: 'viralscore-api',
    name: 'ViralScore API',
    description: 'Predictive virality metrics for content and market analysis',
    category: 'VIRAL_SCORE',
    defaultPlan: 'starter',
    features: [
      'Virality predictions',
      'Content scoring',
      'Trend forecasting',
      'Historical analysis',
      'Confidence metrics',
    ],
    isActive: true,
    plans: [
      {
        code: 'vs-starter',
        name: 'Starter',
        monthlyFee: 1790, // ZAR 1,790 (~$99)
        perCallFee: null,
        rateLimit: 200,
        burstLimit: 300,
        quota: 20000,
        description: 'Get started with virality scoring and predictions',
      },
      {
        code: 'vs-pro',
        name: 'Pro',
        monthlyFee: 17990, // ZAR 17,990 (~$999)
        perCallFee: null,
        rateLimit: 10000,
        burstLimit: 15000,
        quota: 2000000,
        description: 'Advanced virality analytics for professional use',
      },
    ],
  },
  {
    slug: 'sentiment-deception-api',
    name: 'Sentiment + Deception API',
    description: 'Advanced sentiment analysis with deception detection capabilities',
    category: 'SENTIMENT',
    defaultPlan: 'pro',
    features: [
      'Sentiment analysis',
      'Deception detection',
      'Truth tension scoring',
      'Evidence tracking',
      'Confidence metrics',
      'Batch processing',
    ],
    isActive: true,
    plans: [
      {
        code: 'sd-pro',
        name: 'Pro',
        monthlyFee: 17990, // ZAR 17,990 (~$999)
        perCallFee: null,
        rateLimit: 5000,
        burstLimit: 7500,
        quota: 1000000,
        description: 'Professional sentiment and deception analysis',
      },
      {
        code: 'sd-enterprise',
        name: 'Enterprise',
        monthlyFee: null, // Custom pricing
        perCallFee: 2.0, // ZAR 2.00 per call
        rateLimit: 50000,
        burstLimit: 75000,
        quota: null,
        description: 'Custom enterprise solution with dedicated support',
      },
    ],
  },
];

async function seedApiProducts() {
  console.log('🌱 Seeding API Marketplace products...');

  try {
    for (const productData of API_PRODUCTS) {
      // Check if product already exists
      const existingProduct = await prisma.apiProduct.findUnique({
        where: { slug: productData.slug },
        include: { plans: true },
      });

      let product;

      if (existingProduct) {
        console.log(`✅ Product '${productData.name}' already exists, updating...`);

        // Update product
        product = await prisma.apiProduct.update({
          where: { id: existingProduct.id },
          data: {
            name: productData.name,
            description: productData.description,
            category: productData.category,
            defaultPlan: productData.defaultPlan,
            features: productData.features,
            isActive: productData.isActive,
          },
        });

        // Update or create plans
        for (const planData of productData.plans) {
          const existingPlan = existingProduct.plans.find(p => p.code === planData.code);

          if (existingPlan) {
            await prisma.apiPlan.update({
              where: { id: existingPlan.id },
              data: {
                name: planData.name,
                monthlyFee: planData.monthlyFee,
                perCallFee: planData.perCallFee,
                rateLimit: planData.rateLimit,
                burstLimit: planData.burstLimit,
                quota: planData.quota,
                description: planData.description,
              },
            });
            console.log(`  ✅ Updated plan: ${planData.name}`);
          } else {
            await prisma.apiPlan.create({
              data: {
                productId: product.id,
                code: planData.code,
                name: planData.name,
                monthlyFee: planData.monthlyFee,
                perCallFee: planData.perCallFee,
                rateLimit: planData.rateLimit,
                burstLimit: planData.burstLimit,
                quota: planData.quota,
                description: planData.description,
              },
            });
            console.log(`  ✅ Created plan: ${planData.name}`);
          }
        }
      } else {
        console.log(`📦 Creating product: ${productData.name}`);

        // Create new product with plans
        product = await prisma.apiProduct.create({
          data: {
            slug: productData.slug,
            name: productData.name,
            description: productData.description,
            category: productData.category,
            defaultPlan: productData.defaultPlan,
            features: productData.features,
            isActive: productData.isActive,
            plans: {
              create: productData.plans.map(plan => ({
                code: plan.code,
                name: plan.name,
                monthlyFee: plan.monthlyFee,
                perCallFee: plan.perCallFee,
                rateLimit: plan.rateLimit,
                burstLimit: plan.burstLimit,
                quota: plan.quota,
                description: plan.description,
              })),
            },
          },
          include: { plans: true },
        });

        console.log(`  ✅ Created ${product.plans.length} plans`);
      }
    }

    // Display summary
    const productCount = await prisma.apiProduct.count();
    const planCount = await prisma.apiPlan.count();

    console.log('\n✨ API Marketplace seeding complete!');
    console.log(`📊 Products: ${productCount}`);
    console.log(`💳 Plans: ${planCount}`);
    console.log('\n🚀 API Marketplace is ready for use!');

    // Show pricing summary
    console.log('\n💰 Pricing Summary (ZAR):');
    for (const product of API_PRODUCTS) {
      console.log(`\n${product.name}:`);
      for (const plan of product.plans) {
        if (plan.monthlyFee) {
          console.log(`  - ${plan.name}: ZAR ${plan.monthlyFee.toLocaleString()}/month`);
        } else if (plan.perCallFee) {
          console.log(`  - ${plan.name}: ZAR ${plan.perCallFee}/call`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error seeding API products:', error);
    throw error;
  }
}

async function main() {
  await seedApiProducts();
  await prisma.$disconnect();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedApiProducts };