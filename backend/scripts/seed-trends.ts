import { PrismaClient, TopicStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed 5 trending topics for ViralFX
 * These are real trending topics in South Africa as of January 2026
 */

const trendingTopics = [
  {
    name: '#BBMzansiS6',
    slug: 'bbmzansi-s6',
    category: 'ENTERTAINMENT',
    title: 'Big Brother Mzansi Season 6',
    description: 'Big Brother Mzansi Season 6 episodes driving massive social engagement across X (Twitter) & TikTok',
    symbol: '$BBMZA',
    alias: 'BBMzansi',
    region: 'ZA',
    status: TopicStatus.ACTIVE,
    isVerified: true,
    metadata: {
      hashtags: ['#BBMzansiS6', '#BigBrotherMzansi'],
      keywords: ['bbmzansi', 'big brother', 'reality tv', 'showmax'],
      entities: ['Liema Pantsi', 'Siphesihle'],
      platforms: ['twitter', 'tiktok', 'instagram'],
      viralScore: 0.95,
      engagement: 'very_high',
      source: 'SOCIAL_SEED',
      oracleStatus: 'BOOTSTRAP_ACTIVE'
    }
  },
  {
    name: '#Venezuelacrisis',
    slug: 'venezuela-crisis',
    category: 'POLITICS',
    title: 'Venezuela Crisis',
    description: 'Renewed sanctions debate and international commentary causing global reaction and discussion',
    symbol: '$VENZ',
    alias: 'Venezuela',
    region: 'GLOBAL',
    status: TopicStatus.ACTIVE,
    isVerified: true,
    metadata: {
      hashtags: ['#Venezuelacrisis', '#Venezuela'],
      keywords: ['venezuela', 'sanctions', 'politics', 'crisis', 'trump'],
      entities: ['Trump Administration', 'Maduro'],
      platforms: ['twitter', 'facebook', 'news'],
      viralScore: 0.78,
      engagement: 'high',
      source: 'SOCIAL_SEED',
      oracleStatus: 'BOOTSTRAP_ACTIVE'
    }
  },
  {
    name: '#MatricResults2025',
    slug: 'matric-results-2025',
    category: 'EDUCATION',
    title: 'Matric Results 2025',
    description: 'National release of matric exam results across South Africa',
    symbol: '$MATRIC',
    alias: 'Matric 2025',
    region: 'ZA',
    status: TopicStatus.ACTIVE,
    isVerified: true,
    metadata: {
      hashtags: ['#MatricResults2025', '#MatricResults', '#NSCResults'],
      keywords: ['matric', 'results', 'education', 'grade 12', 'nsc'],
      entities: ['DBE', 'Basic Education'],
      platforms: ['twitter', 'facebook', 'news'],
      viralScore: 0.82,
      engagement: 'high',
      source: 'SOCIAL_SEED',
      oracleStatus: 'BOOTSTRAP_ACTIVE'
    }
  },
  {
    name: '#LiemaPantsi',
    slug: 'liema-pantsi',
    category: 'ENTERTAINMENT',
    title: 'Liema Pantsi',
    description: 'Breakout personality from BBMzansi gaining massive fanbase and social media following',
    symbol: '$LIEMA',
    alias: 'Liema',
    region: 'ZA',
    status: TopicStatus.ACTIVE,
    isVerified: true,
    metadata: {
      hashtags: ['#LiemaPantsi', '#Liema'],
      keywords: ['liema', 'pantsi', 'bbmzansi', 'influencer'],
      entities: ['Liema Pantsi'],
      platforms: ['twitter', 'tiktok', 'instagram'],
      viralScore: 0.92,
      engagement: 'very_high',
      source: 'SOCIAL_SEED',
      oracleStatus: 'BOOTSTRAP_ACTIVE'
    }
  },
  {
    name: '#RealMadrid',
    slug: 'real-madrid',
    category: 'SPORTS',
    title: 'Real Madrid FC',
    description: 'Match results, transfer rumours, and global fanbase discussion',
    symbol: '$RM',
    alias: 'Real Madrid',
    region: 'GLOBAL',
    status: TopicStatus.ACTIVE,
    isVerified: true,
    metadata: {
      hashtags: ['#RealMadrid', '#HalaMadrid', '#RMA'],
      keywords: ['real madrid', 'football', 'soccer', 'la liga', 'ucl'],
      entities: ['Real Madrid', 'Carlo Ancelotti', 'Vinicius Jr'],
      platforms: ['twitter', 'facebook', 'instagram', 'youtube'],
      viralScore: 0.88,
      engagement: 'very_high',
      source: 'SOCIAL_SEED',
      oracleStatus: 'BOOTSTRAP_ACTIVE'
    }
  }
];

/**
 * Create Oracle proofs for each trend
 */
async function createOracleProofs(topicId: string, trendName: string) {
  const viralityScore = Math.random() * 0.4 + 0.5; // 0.5 to 0.9
  const confidence = Math.random() * 0.3 + 0.6; // 0.6 to 0.9

  return await prisma.oracleProof.create({
    data: {
      trendId: topicId,
      viralityScore: viralityScore,
      confidence: confidence,
      proofHash: Buffer.from(`${topicId}-${Date.now()}`).toString('base64').substring(0, 64),
      merkleRoot: Buffer.from(`merkle-${topicId}`).toString('hex').substring(0, 64),
      consensusLevel: 0.85,
      consensusStrength: 0.78,
      validatorSignatures: {
        validators: ['validator1', 'validator2', 'validator3'],
        signatures: ['sig1', 'sig2', 'sig3']
      },
      payload: {
        trend: trendName,
        source: 'SOCIAL_SEED',
        timestamp: new Date().toISOString(),
        metrics: {
          mentions: Math.floor(Math.random() * 100000) + 50000,
          engagement: Math.floor(Math.random() * 500000) + 100000,
          reach: Math.floor(Math.random() * 1000000) + 500000
        }
      },
      networkType: 'docker-simulated',
      verified: true
    }
  });
}

/**
 * Create prediction markets for topics
 */
async function createMarkets(topicId: string, topicName: string, category: string) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const markets = [];

  if (category === 'ENTERTAINMENT') {
    markets.push({
      topicId,
      marketType: 'BINARY',
      question: `Will ${topicName} trend for 7+ consecutive days?`,
      description: `This market resolves to YES if ${topicName} remains in the top 10 trending topics for 7 consecutive days.`,
      openAt: now,
      closeAt: nextWeek,
      settleAt: nextWeek,
      status: 'OPEN',
      settlementParams: {
        type: 'trending_duration',
        threshold: 7,
        metric: 'consecutive_days'
      },
      oddsYes: 0.65,
      oddsNo: 0.35,
      liquidityPool: 5000
    });
  }

  if (category === 'POLITICS') {
    markets.push({
      topicId,
      marketType: 'BINARY',
      question: `Will sanctions expand in the next 30 days?`,
      description: 'This market resolves to YES if new sanctions are announced within 30 days.',
      openAt: now,
      closeAt: nextMonth,
      settleAt: nextMonth,
      status: 'OPEN',
      settlementParams: {
        type: 'event_occurrence',
        event: 'sanctions_expansion'
      },
      oddsYes: 0.45,
      oddsNo: 0.55,
      liquidityPool: 10000
    });
  }

  if (category === 'EDUCATION') {
    markets.push({
      topicId,
      marketType: 'BINARY',
      question: `Will the pass rate increase vs 2024?`,
      description: 'This market resolves to YES if the 2025 matric pass rate is higher than 2024.',
      openAt: now,
      closeAt: nextMonth,
      settleAt: nextMonth,
      status: 'OPEN',
      settlementParams: {
        type: 'comparison',
        baseline: 2024,
        metric: 'pass_rate'
      },
      oddsYes: 0.55,
      oddsNo: 0.45,
      liquidityPool: 7500
    });
  }

  if (category === 'SPORTS') {
    markets.push({
      topicId,
      marketType: 'BINARY',
      question: `Will Real Madrid win their next UCL match?`,
      description: 'This market resolves to YES if Real Madrid wins their next Champions League match.',
      openAt: now,
      closeAt: nextWeek,
      settleAt: nextWeek,
      status: 'OPEN',
      settlementParams: {
        type: 'match_result',
        team: 'Real Madrid',
        competition: 'UCL'
      },
      oddsYes: 0.60,
      oddsNo: 0.40,
      liquidityPool: 15000
    });
  }

  // Create all markets for this topic
  for (const market of markets) {
    await prisma.market.create({ data: market });
  }

  return markets.length;
}

async function main() {
  console.log('🌱 Starting to seed 5 trending topics...\n');

  let createdTopics = 0;
  let createdOracleProofs = 0;
  let createdMarkets = 0;

  for (const topic of trendingTopics) {
    try {
      console.log(`📝 Creating topic: ${topic.name}`);

      // Check if topic already exists
      const existing = await prisma.topic.findUnique({
        where: { slug: topic.slug }
      });

      if (existing) {
        console.log(`   ⚠️  Topic already exists, skipping...\n`);
        continue;
      }

      // Create topic
      const createdTopic = await prisma.topic.create({
        data: {
          ...topic,
          canonical: topic.metadata
        }
      });

      console.log(`   ✅ Topic created with ID: ${createdTopic.id}`);
      createdTopics++;

      // Create Oracle proof
      await createOracleProofs(createdTopic.id, topic.name);
      console.log(`   ✅ Oracle proof created`);
      createdOracleProofs++;

      // Create markets
      const marketCount = await createMarkets(createdTopic.id, topic.name, topic.category);
      console.log(`   ✅ Created ${marketCount} prediction markets`);
      createdMarkets++;

      console.log('');

    } catch (error) {
      console.error(`   ❌ Error creating topic ${topic.name}:`, error.message);
      console.log('');
    }
  }

  console.log('========================================');
  console.log('📊 Seeding Summary:');
  console.log(`========================================`);
  console.log(`✅ Topics created: ${createdTopics}`);
  console.log(`✅ Oracle proofs: ${createdOracleProofs}`);
  console.log(`✅ Prediction markets: ${createdMarkets}`);
  console.log('========================================\n');

  // Display verification query
  const totalTopics = await prisma.topic.count();
  const totalOracleProofs = await prisma.oracleProof.count();
  const totalMarkets = await prisma.market.count();

  console.log('🔍 Database Verification:');
  console.log(`   Total topics: ${totalTopics}`);
  console.log(`   Total oracle proofs: ${totalOracleProofs}`);
  console.log(`   Total markets: ${totalMarkets}\n`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
