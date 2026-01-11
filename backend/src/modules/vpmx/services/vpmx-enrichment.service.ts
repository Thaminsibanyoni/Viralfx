import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { HttpService } from '@nestjs/axios';
import { RedisService } from "../../redis/redis.service";
import { VPMXCoreService } from "./vpmx-core.service";
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VPMXEnrichmentService {
  private readonly logger = new Logger(VPMXEnrichmentService.name);
  private readonly ENRICHMENT_CACHE_TTL = 3600; // 1 hour

  constructor(
  private readonly prisma: PrismaService,
  private readonly redis: RedisService,
  private readonly vpmxCoreService: VPMXCoreService,
  private readonly httpService: HttpService) {}

  /**
   * Enrich VPMX with traditional market data
   */
  async enrichWithMarketData(vtsSymbol: string): Promise<any> {
  try {
  this.logger.log(`Enriching ${vtsSymbol} with market data`);
  const cacheKey = `vpmx:enrichment:market:${vtsSymbol}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) {
  return JSON.parse(cached);
  }

      // Extract relevant market identifiers from VTS symbol
  const marketIdentifiers = this.extractMarketIdentifiers(vtsSymbol);

      // Fetch market data from various sources
  const [stockData, cryptoData, commodityData, forexData] = await Promise.all([
  this.fetchStockData(marketIdentifiers),
  this.fetchCryptoData(marketIdentifiers),
  this.fetchCommodityData(marketIdentifiers),
  this.fetchForexData(marketIdentifiers),
      ]);

  const enrichmentData = {
  vtsSymbol,
  timestamp: new Date(),
  marketData: {
  stocks: stockData,
  crypto: cryptoData,
  commodities: commodityData,
  forex: forexData
      },
  correlation: this.calculateMarketCorrelation(vtsSymbol, { stockData, cryptoData, commodityData, forexData }),
  marketImpact: this.assessMarketImpact({ stockData, cryptoData, commodityData, forexData })
      };

      // Cache the result
  await this.redis.setex(cacheKey, this.ENRICHMENT_CACHE_TTL, JSON.stringify(enrichmentData));
  return enrichmentData;
    } catch (error) {
  this.logger.error(`Failed to enrich ${vtsSymbol} with market data`, error);
  throw error;
  }
  }

  /**
   * Enrich with news sentiment analysis
   */
  async enrichWithNewsSentiment(vtsSymbol: string): Promise<any> {
  try {
  this.logger.log(`Enriching ${vtsSymbol} with news sentiment`);
  const cacheKey = `vpmx:enrichment:news:${vtsSymbol}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) {
  return JSON.parse(cached);
  }

      // Get topic keywords from VTS symbol
  const keywords = this.extractKeywordsFromVTS(vtsSymbol);

      // Fetch news from multiple sources
  const newsData = await this.fetchNewsData(keywords);

      // Analyze sentiment
  const sentimentAnalysis = await this.analyzeNewsSentiment(newsData);
  const enrichmentData = {
  vtsSymbol,
  timestamp: new Date(),
  newsData: {
  totalArticles: newsData.length,
  timeRange: '24h',
  sources: this.getNewsSources(newsData)
      },
  sentimentAnalysis,
  trendingTopics: this.extractTrendingTopics(newsData),
  mediaImpact: this.assessMediaImpact(newsData)
  };

  await this.redis.setex(cacheKey, this.ENRICHMENT_CACHE_TTL, JSON.stringify(enrichmentData));
  return enrichmentData;
    } catch (error) {
  this.logger.error(`Failed to enrich ${vtsSymbol} with news sentiment`, error);
  throw error;
  }
  }

  /**
   * Enrich with social media influencer data
   */
  async enrichWithInfluencerData(vtsSymbol: string): Promise<any> {
  try {
  this.logger.log(`Enriching ${vtsSymbol} with influencer data`);
  const cacheKey = `vpmx:enrichment:influencers:${vtsSymbol}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) {
  return JSON.parse(cached);
  }

  const keywords = this.extractKeywordsFromVTS(vtsSymbol);

      // Fetch influencer data from various platforms
  const [twitterData, instagramData, tiktokData, youtubeData] = await Promise.all([
  this.fetchTwitterInfluencers(keywords),
  this.fetchInstagramInfluencers(keywords),
  this.fetchTikTokInfluencers(keywords),
  this.fetchYouTubeInfluencers(keywords),
      ]);

  const influencerAnalysis = this.analyzeInfluencerImpact({
  twitter: twitterData,
  instagram: instagramData,
  tiktok: tiktokData,
  youtube: youtubeData
      });

      // Save influencer impact to database
  await this.saveInfluencerImpact(vtsSymbol, influencerAnalysis);

  const enrichmentData = {
  vtsSymbol,
  timestamp: new Date(),
  influencerData: {
  twitter: twitterData,
  instagram: instagramData,
  tiktok: tiktokData,
  youtube: youtubeData
      },
  influencerAnalysis,
  networkEffects: this.calculateNetworkEffects(influencerAnalysis),
  predictionModel: this.buildInfluencerPredictionModel(influencerAnalysis)
  };

  await this.redis.setex(cacheKey, this.ENRICHMENT_CACHE_TTL, JSON.stringify(enrichmentData));
  return enrichmentData;
    } catch (error) {
  this.logger.error(`Failed to enrich ${vtsSymbol} with influencer data`, error);
  throw error;
  }
  }

  /**
   * Enrich with geographic and demographic data
   */
  async enrichWithGeographicData(vtsSymbol: string): Promise<any> {
  try {
  this.logger.log(`Enriching ${vtsSymbol} with geographic data`);
  const cacheKey = `vpmx:enrichment:geo:${vtsSymbol}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) {
  return JSON.parse(cached);
  }

  const region = this.extractRegionFromVTS(vtsSymbol);

      // Fetch geographic data
  const [regionalMetrics, demographicData, culturalMetrics] = await Promise.all([
  this.fetchRegionalMetrics(region),
  this.fetchDemographicData(region),
  this.fetchCulturalMetrics(vtsSymbol),
      ]);

  const geoAnalysis = this.analyzeGeographicPatterns({
  regionalMetrics,
  demographicData,
  culturalMetrics
      });

  const enrichmentData = {
  vtsSymbol,
  region,
  timestamp: new Date(),
  geographicData: {
  regionalMetrics,
  demographicData,
  culturalMetrics
  },
  geoAnalysis,
  regionalComparison: this.compareToRegionalBenchmark(region, geoAnalysis)
  };

  await this.redis.setex(cacheKey, this.ENRICHMENT_CACHE_TTL, JSON.stringify(enrichmentData));
  return enrichmentData;
    } catch (error) {
  this.logger.error(`Failed to enrich ${vtsSymbol} with geographic data`, error);
  throw error;
  }
  }

  /**
   * Batch enrichment for multiple symbols
   */
  async batchEnrichment(vtsSymbols: string[]): Promise<any> {
  try {
  this.logger.log(`Starting batch enrichment for ${vtsSymbols.length} symbols`);
  const enrichmentTasks = vtsSymbols.map(symbol =>
  this.enrichSymbolBatch(symbol)
  );

  const results = await Promise.allSettled(enrichmentTasks);
  const successful = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

  const failed = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result, index) => ({
  symbol: vtsSymbols[index],
  error: result.reason.message
  }));

  return {
  totalSymbols: vtsSymbols.length,
  successful: successful.length,
  failed: failed.length,
  results: successful,
  errors: failed,
  timestamp: new Date()
  };
    } catch (error) {
  this.logger.error('Batch enrichment failed', error);
  throw error;
  }
  }

  // Private helper methods for data fetching
  private async enrichSymbolBatch(vtsSymbol: string): Promise<any> {
  const [marketData, newsSentiment, influencerData, geographicData] = await Promise.all([
  this.enrichWithMarketData(vtsSymbol),
  this.enrichWithNewsSentiment(vtsSymbol),
  this.enrichWithInfluencerData(vtsSymbol),
  this.enrichWithGeographicData(vtsSymbol),
  ]);

  return {
  vtsSymbol,
  marketData,
  newsSentiment,
  influencerData,
  geographicData,
  aggregatedScore: this.calculateAggregatedEnrichmentScore({
  marketData,
  newsSentiment,
  influencerData,
  geographicData
  })
  };
  }

  private extractMarketIdentifiers(vtsSymbol: string): any {
    // Extract company names, tickers, or related market identifiers from VTS symbol
  const parts = vtsSymbol.split(':');
  const identifier = parts[parts.length - 1];
  return {
  companyName: identifier.replace(/[0-9]/g, ''),
  tickers: this.generatePotentialTickers(identifier),
  sector: this.inferSector(identifier)
  };
  }

  private async fetchStockData(identifiers: any): Promise<any> {
  try {
      // Mock stock data - in production would use Alpha Vantage, Yahoo Finance API
  return {
  price: 150.25,
  change: 2.45,
  changePercent: 1.66,
  volume: 12500000,
  marketCap: 2500000000,
  pe: 18.5,
  eps: 8.12
  };
    } catch (error) {
  this.logger.warn('Failed to fetch stock data', error);
  return null;
  }
  }

  private async fetchCryptoData(identifiers: any): Promise<any> {
  try {
      // Mock crypto data - would use CoinGecko, CoinMarketCap APIs
  return {
  price: 45000.50,
  change24h: 1250.75,
  changePercent24h: 2.86,
  volume24h: 2500000000,
  marketCap: 850000000000,
  dominance: 0.45
  };
    } catch (error) {
  this.logger.warn('Failed to fetch crypto data', error);
  return null;
  }
  }

  private async fetchCommodityData(identifiers: any): Promise<any> {
  try {
      // Mock commodity data
  return {
  gold: 1850.25,
  oil: 78.50,
  silver: 24.15,
  change24h: {
  gold: 0.5,
  oil: -1.2,
  silver: 0.8
  }
  };
    } catch (error) {
  this.logger.warn('Failed to fetch commodity data', error);
  return null;
  }
  }

  private async fetchForexData(identifiers: any): Promise<any> {
  try {
      // Mock forex data
  return {
  EURUSD: 1.0850,
  GBPUSD: 1.2745,
  USDJPY: 148.25,
  change24h: {
  EURUSD: 0.15,
  GBPUSD: -0.08,
  USDJPY: 0.25
  }
  };
    } catch (error) {
  this.logger.warn('Failed to fetch forex data', error);
  return null;
  }
  }

  private async fetchNewsData(keywords: string[]): Promise<any[]> {
  try {
      // Mock news data - would use NewsAPI, GDELT, or similar
  return [
  {
  title: 'Breaking: Major Announcement in Entertainment Sector',
  source: 'Reuters',
  url: 'https://example.com/news1',
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  sentiment: 0.75,
  relevance: 0.9
  },
  {
  title: 'Market Analysis: Social Media Trends Impact',
  source: 'Bloomberg',
  url: 'https://example.com/news2',
  publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  sentiment: 0.45,
  relevance: 0.7
  },
  ];
    } catch (error) {
  this.logger.warn('Failed to fetch news data', error);
  return [];
  }
  }

  private async analyzeNewsSentiment(newsData: any[]): Promise<any> {
  if (newsData.length === 0) {
  return {
  overallSentiment: 0.5,
  sentimentDistribution: { positive: 0.33, negative: 0.33, neutral: 0.34 },
  averageRelevance: 0,
  trendDirection: 'NEUTRAL'
  };
  }

  const sentiments = newsData.map(n => n.sentiment);
  const overallSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
  const relevanceScores = newsData.map(n => n.relevance);
  const averageRelevance = relevanceScores.reduce((sum, r) => sum + r, 0) / relevanceScores.length;

  const sentimentDistribution = {
  positive: sentiments.filter(s => s > 0.6).length / sentiments.length,
  negative: sentiments.filter(s => s < 0.4).length / sentiments.length,
  neutral: sentiments.filter(s => s >= 0.4 && s <= 0.6).length / sentiments.length
  };

  return {
  overallSentiment,
  sentimentDistribution,
  averageRelevance,
  trendDirection: overallSentiment > 0.55 ? 'POSITIVE' : overallSentiment < 0.45 ? 'NEGATIVE' : 'NEUTRAL',
  volatility: this.calculateSentimentVolatility(sentiments)
  };
  }

  private async fetchTwitterInfluencers(keywords: string[]): Promise<any[]> {
    // Mock Twitter influencer data
  return [
  {
  handle: '@celebrity1',
  followers: 5000000,
  engagementRate: 0.08,
  sentimentBias: 'POSITIVE',
  recentMentions: 15,
  impactScore: 0.85
  },
  {
  handle: '@influencer2',
  followers: 1200000,
  engagementRate: 0.12,
  sentimentBias: 'POSITIVE',
  recentMentions: 8,
  impactScore: 0.65
  },
  ];
  }

  private async fetchInstagramInfluencers(keywords: string[]): Promise<any[]> {
    // Mock Instagram data
  return [
  {
  handle: '@instafamous',
  followers: 3000000,
  engagementRate: 0.06,
  sentimentBias: 'POSITIVE',
  recentMentions: 12,
  impactScore: 0.75
  },
  ];
  }

  private async fetchTikTokInfluencers(keywords: string[]): Promise<any[]> {
    // Mock TikTok data
  return [
  {
  handle: '@tiktokstar',
  followers: 8000000,
  engagementRate: 0.15,
  sentimentBias: 'POSITIVE',
  recentMentions: 25,
  impactScore: 0.90
  },
  ];
  }

  private async fetchYouTubeInfluencers(keywords: string[]): Promise<any[]> {
    // Mock YouTube data
  return [
  {
  handle: '@youtuber',
  subscribers: 2000000,
  engagementRate: 0.05,
  sentimentBias: 'NEUTRAL',
  recentMentions: 5,
  impactScore: 0.60
  },
  ];
  }

  private analyzeInfluencerImpact(data: any): any {
  const allInfluencers = [
      ...data.twitter,
      ...data.instagram,
      ...data.tiktok,
      ...data.youtube,
  ];

  const totalReach = allInfluencers.reduce((sum, inf) => sum + inf.followers, 0);
  const weightedEngagement = allInfluencers.reduce((sum, inf) =>
  sum + inf.followers * inf.engagementRate, 0
  ) / totalReach;

  const sentimentBreakdown = allInfluencers.reduce((acc, inf) => {
  acc[inf.sentimentBias.toLowerCase()] = (acc[inf.sentimentBias.toLowerCase()] || 0) + 1;
  return acc;
  }, {});

  return {
  totalInfluencers: allInfluencers.length,
  totalReach,
  weightedEngagement,
  topPlatforms: this.getTopPlatforms(data),
  sentimentBreakdown,
  averageImpactScore: allInfluencers.reduce((sum, inf) => sum + inf.impactScore, 0) / allInfluencers.length
  };
  }

  private async fetchRegionalMetrics(region: string): Promise<any> {
    // Mock regional data
  return {
  population: 50000000,
  internetPenetration: 0.85,
  socialMediaUsage: 0.72,
  averageIncome: 45000,
  timeSpentOnSocialMedia: 3.2 // hours per day
  };
  }

  private async fetchDemographicData(region: string): Promise<any> {
    // Mock demographic data
  return {
  ageGroups: {
  '13-17': 0.15,
  '18-24': 0.25,
  '25-34': 0.30,
  '35-44': 0.20,
  '45+': 0.10
  },
  genderDistribution: {
  male: 0.48,
  female: 0.52
  },
  urbanization: 0.75,
  educationLevel: {
  highSchool: 0.30,
  bachelor: 0.45,
  graduate: 0.25
  }
  };
  }

  private async fetchCulturalMetrics(vtsSymbol: string): Promise<any> {
    // Mock cultural data
  return {
  culturalRelevance: 0.78,
  localTrendsAlignment: 0.65,
  culturalSensitivity: 0.85,
  regionalPopularity: 0.72
  };
  }

  // Utility methods
  private extractKeywordsFromVTS(vtsSymbol: string): string[] {
  const parts = vtsSymbol.split(':');
  const identifier = parts[parts.length - 1];

    // Simple keyword extraction - would use NLP in production
  return identifier.split(/(?=[A-Z][a-z])/).filter(word => word.length > 2);
  }

  private extractRegionFromVTS(vtsSymbol: string): string {
  const parts = vtsSymbol.split(':');
  return parts.length > 1 ? parts[1] : 'GLOBAL';
  }

  private calculateMarketCorrelation(vtsSymbol: string, marketData: any): any {
    // Mock correlation calculation
  return {
  stocks: 0.65,
  crypto: 0.45,
  commodities: 0.25,
  forex: 0.15
  };
  }

  private assessMarketImpact(marketData: any): string {
    // Simplified market impact assessment
  const positiveSignals = Object.values(marketData).filter(data =>
  data && (data.changePercent > 0 || data.change24h > 0)
  ).length;

  return positiveSignals > 2 ? 'HIGH' : positiveSignals > 1 ? 'MEDIUM' : 'LOW';
  }

  private getNewsSources(newsData: any[]): string[] {
  return [...new Set(newsData.map(n => n.source))];
  }

  private extractTrendingTopics(newsData: any[]): string[] {
    // Mock topic extraction - would use NLP in production
  return ['entertainment', 'social media', 'viral trends'];
  }

  private assessMediaImpact(newsData: any[]): any {
  const totalRelevance = newsData.reduce((sum, n) => sum + n.relevance, 0);
  const averageRelevance = totalRelevance / newsData.length;

  return {
  score: averageRelevance,
  volume: newsData.length,
  reach: totalRelevance * 1000000 // Mock reach calculation
  };
  }

  private getTopPlatforms(data: any): string[] {
  const platformCounts = {
  twitter: data.twitter.length,
  instagram: data.instagram.length,
  tiktok: data.tiktok.length,
  youtube: data.youtube.length
  };

  return Object.entries(platformCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([platform]) => platform);
  }

  private calculateNetworkEffects(influencerAnalysis: any): any {
  return {
  networkMultiplier: 1.5,
  viralCoefficient: 2.3,
  saturationPoint: 0.75,
  networkDensity: 0.65
  };
  }

  private buildInfluencerPredictionModel(influencerAnalysis: any): any {
  return {
  modelType: 'INFLUENCER_WEIGHTED',
  weights: {
  reach: 0.4,
  engagement: 0.35,
  sentiment: 0.15,
  timeliness: 0.1
  },
  predictionHorizon: '7d',
  confidence: influencerAnalysis.averageImpactScore
  };
  }

  private analyzeGeographicPatterns(data: any): any {
  return {
  regionalFit: 0.78,
  demographicAlignment: 0.65,
  culturalCompatibility: 0.85,
  marketPotential: 0.72
  };
  }

  private compareToRegionalBenchmark(region: string, analysis: any): any {
    // Mock regional benchmark comparison
  return {
  aboveAverage: true,
  percentileRank: 0.78,
  regionalLeader: false,
  growthPotential: 'HIGH'
  };
  }

  private calculateAggregatedEnrichmentScore(data: any): number {
  const weights = {
  marketData: 0.25,
  newsSentiment: 0.25,
  influencerData: 0.35,
  geographicData: 0.15
  };

  const scores = {
  marketData: this.calculateMarketDataScore(data.marketData),
  newsSentiment: data.newsSentiment.averageRelevance,
  influencerData: data.influencerData.influencerAnalysis.averageImpactScore,
  geographicData: data.geographicData.geoAnalysis.regionalFit
  };

  return Object.entries(weights).reduce((sum, [key, weight]) =>
  sum + scores[key as keyof typeof scores] * weight, 0
  );
  }

  private calculateMarketDataScore(marketData: any): number {
    // Simplified market data scoring
  if (!marketData.marketData) return 0;

  const impactScore = marketData.marketImpact === 'HIGH' ? 0.9 :
  marketData.marketImpact === 'MEDIUM' ? 0.6 : 0.3;

  const correlationScore = Object.values(marketData.correlation)
      .reduce((sum: number, corr: number) => sum + corr, 0) / 4;

  return (impactScore + correlationScore) / 2;
  }

  private calculateSentimentVolatility(sentiments: number[]): number {
  const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
  const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
  return Math.sqrt(variance);
  }

  private generatePotentialTickers(identifier: string): string[] {
    // Generate potential stock tickers from identifier
  const cleaned = identifier.replace(/[^A-Z]/g, '');
  return [
  cleaned.slice(0, 3).toUpperCase(),
  cleaned.slice(0, 4).toUpperCase(),
  cleaned.slice(0, 5).toUpperCase(),
  ];
  }

  private inferSector(identifier: string): string {
    // Simple sector inference - would use ML in production
  const entertainmentKeywords = ['music', 'movie', 'celebrity', 'entertainment', 'album'];
  const techKeywords = ['tech', 'startup', 'app', 'software', 'digital'];
  const sportsKeywords = ['sport', 'athlete', 'team', 'game', 'championship'];
  const lower = identifier.toLowerCase();

  if (entertainmentKeywords.some(kw => lower.includes(kw))) return 'ENTERTAINMENT';
  if (techKeywords.some(kw => lower.includes(kw))) return 'TECHNOLOGY';
  if (sportsKeywords.some(kw => lower.includes(kw))) return 'SPORTS';
  return 'GENERAL';
  }

  private async saveInfluencerImpact(vtsSymbol: string, analysis: any): Promise<void> {
    // Save top influencers to database
  const topInfluencers = [
      ...analysis.twitter.slice(0, 2),
      ...analysis.instagram.slice(0, 1),
      ...analysis.tiktok.slice(0, 2),
      ...analysis.youtube.slice(0, 1),
  ];

  for (const influencer of topInfluencers) {
  try {
  await this.prisma.vpmxInfluencerImpact.upsert({
  where: {
  vtsSymbol_handle: {
  vtsSymbol,
  handle: influencer.handle
  }
  },
  update: {
  followers: influencer.followers,
  influenceScore: influencer.impactScore,
  engagementRate: influencer.engagementRate,
  sentimentBias: influencer.sentimentBias,
  mentionCount: influencer.recentMentions,
  lastSeenAt: new Date()
  },
  create: {
  vtsSymbol,
  platform: this.inferPlatform(influencer.handle),
  handle: influencer.handle,
  followers: influencer.followers,
  influenceScore: influencer.impactScore,
  engagementRate: influencer.engagementRate,
  sentimentBias: influencer.sentimentBias,
  mentionCount: influencer.recentMentions
  }
  });
  } catch (error) {
  this.logger.warn(`Failed to save influencer ${influencer.handle}`, error);
  }
  }
  }

  private inferPlatform(handle: string): string {
  if (handle.startsWith('@')) {
  if (handle.includes('tiktok') || handle.includes('tt')) return 'TIKTOK';
  if (handle.includes('insta') || handle.includes('ig')) return 'INSTAGRAM';
  if (handle.includes('yt') || handle.includes('tube')) return 'YOUTUBE';
  return 'TWITTER';
  }
  return 'TWITTER'; // Default
  }
}