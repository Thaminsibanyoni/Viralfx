/**
 * VTS Human-Readable Symbol Alias System
 * User-friendly aliases and URL shortcuts for VTS symbols
 * © 2025 ViralFX - User Experience Enhancement
 */

import { createHash } from 'crypto';
import { VTSSymbol } from '../../types/vts';

export interface VTSAlias {
  id: string;
  alias: string;
  symbol: string;
  type: AliasType;
  status: AliasStatus;
  createdAt: Date;
  createdBy: string;
  expiresAt?: Date;
  clickCount: number;
  lastAccessed?: Date;
  metadata: AliasMetadata;
}

export interface AliasMetadata {
  description: string;
  tags: string[];
  seoOptimized: boolean;
  shortUrl?: string;
  qrCode?: string;
  campaign?: string;
  source: string;
}

export enum AliasType {
  HUMAN_READABLE = 'HUMAN_READABLE',
  SEO_FRIENDLY = 'SEO_FRIENDLY',
  MARKETING_CAMPAIGN = 'MARKETING_CAMPAIGN',
  SOCIAL_SHARE = 'SOCIAL_SHARE',
  ANALYTICS_TRACKING = 'ANALYTICS_TRACKING',
  TEMPORARY = 'TEMPORARY',
  CUSTOM = 'CUSTOM'
}

export enum AliasStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
  DEPRECATED = 'DEPRECATED',
  BANNED = 'BANNED'
}

export interface AliasGenerationRequest {
  symbol: string;
  preferredAlias?: string;
  type: AliasType;
  createdBy: string;
  metadata: Partial<AliasMetadata>;
  expiryDays?: number;
}

export interface AliasAnalytics {
  aliasId: string;
  totalClicks: number;
  uniqueVisitors: number;
  conversionRate: number;
  averageTimeOnPage: number;
  bounceRate: number;
  trafficSources: TrafficSource[];
  deviceBreakdown: DeviceBreakdown;
  geographicBreakdown: GeographicBreakdown;
  temporalData: TemporalData[];
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
  other: number;
}

export interface GeographicBreakdown {
  country: string;
  count: number;
  percentage: number;
}

export interface TemporalData {
  date: Date;
  clicks: number;
  uniqueVisitors: number;
}

export class VTSAliasSystem {
  private aliases: Map<string, VTSAlias> = new Map(); // alias -> VTSAlias
  private symbolToAliases: Map<string, string[]> = new Map(); // symbol -> aliases[]
  private shortUrlGenerator: ShortUrlGenerator;
  private aliasAnalytics: Map<string, AliasAnalytics> = new Map();

  constructor() {
    this.shortUrlGenerator = new ShortUrlGenerator();
  }

  /**
   * Generate a human-readable alias for a VTS symbol
   */
  async generateAlias(request: AliasGenerationRequest): Promise<VTSAlias> {
    // Validate symbol exists
    if (!this.isValidSymbol(request.symbol)) {
      throw new Error(`Invalid symbol: ${request.symbol}`);
    }

    // Generate alias
    let alias = request.preferredAlias || this.generateHumanReadableAlias(request);

    // Ensure uniqueness
    alias = await this.ensureUniqueAlias(alias);

    // Create alias record
    const vtsAlias: VTSAlias = {
      id: this.generateAliasId(),
      alias,
      symbol: request.symbol,
      type: request.type,
      status: AliasStatus.ACTIVE,
      createdAt: new Date(),
      createdBy: request.createdBy,
      expiresAt: request.expiryDays ? new Date(Date.now() + request.expiryDays * 24 * 60 * 60 * 1000) : undefined,
      clickCount: 0,
      metadata: {
        description: request.metadata.description || `Alias for ${request.symbol}`,
        tags: request.metadata.tags || [],
        seoOptimized: request.metadata.seoOptimized || false,
        source: request.metadata.source || 'manual'
      }
    };

    // Generate short URL
    vtsAlias.metadata.shortUrl = await this.shortUrlGenerator.generateShortUrl(alias);

    // Store alias
    this.aliases.set(alias, vtsAlias);

    // Update symbol to aliases mapping
    const existingAliases = this.symbolToAliases.get(request.symbol) || [];
    existingAliases.push(alias);
    this.symbolToAliases.set(request.symbol, existingAliases);

    // Initialize analytics
    this.aliasAnalytics.set(vtsAlias.id, {
      aliasId: vtsAlias.id,
      totalClicks: 0,
      uniqueVisitors: 0,
      conversionRate: 0,
      averageTimeOnPage: 0,
      bounceRate: 0,
      trafficSources: [],
      deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0, other: 0 },
      geographicBreakdown: [],
      temporalData: []
    });

    return vtsAlias;
  }

  /**
   * Resolve alias to symbol
   */
  resolveAlias(alias: string): string | null {
    const vtsAlias = this.aliases.get(alias);
    if (!vtsAlias) {
      return null;
    }

    // Check status
    if (vtsAlias.status !== AliasStatus.ACTIVE) {
      return null;
    }

    // Check expiry
    if (vtsAlias.expiresAt && vtsAlias.expiresAt < new Date()) {
      vtsAlias.status = AliasStatus.EXPIRED;
      return null;
    }

    // Update analytics
    this.trackAliasAccess(vtsAlias);

    return vtsAlias.symbol;
  }

  /**
   * Get all aliases for a symbol
   */
  getAliasesForSymbol(symbol: string): VTSAlias[] {
    const aliasNames = this.symbolToAliases.get(symbol) || [];
    return aliasNames
      .map(alias => this.aliases.get(alias))
      .filter(alias => alias && alias.status === AliasStatus.ACTIVE) as VTSAlias[];
  }

  /**
   * Search aliases
   */
  searchAliases(query: string, filters?: AliasSearchFilters): VTSAlias[] {
    const results: VTSAlias[] = [];
    const queryLower = query.toLowerCase();

    for (const alias of this.aliases.values()) {
      // Skip inactive aliases
      if (alias.status !== AliasStatus.ACTIVE) {
        continue;
      }

      // Check expiry
      if (alias.expiresAt && alias.expiresAt < new Date()) {
        continue;
      }

      // Search match
      const matches =
        alias.alias.toLowerCase().includes(queryLower) ||
        alias.metadata.description.toLowerCase().includes(queryLower) ||
        alias.metadata.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
        alias.symbol.toLowerCase().includes(queryLower);

      if (matches) {
        // Apply filters
        if (this.matchesFilters(alias, filters)) {
          results.push(alias);
        }
      }
    }

    // Sort by relevance
    return results.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, query);
      const bScore = this.calculateRelevanceScore(b, query);
      return bScore - aScore;
    });
  }

  /**
   * Get alias analytics
   */
  getAliasAnalytics(aliasId: string): AliasAnalytics | null {
    return this.aliasAnalytics.get(aliasId) || null;
  }

  /**
   * Update alias status
   */
  updateAliasStatus(alias: string, status: AliasStatus, reason?: string): boolean {
    const vtsAlias = this.aliases.get(alias);
    if (!vtsAlias) {
      return false;
    }

    vtsAlias.status = status;
    // Add audit log entry here if needed

    return true;
  }

  /**
   * Generate batch aliases
   */
  async generateBatchAliases(requests: AliasGenerationRequest[]): Promise<VTSAlias[]> {
    const results: VTSAlias[] = [];

    for (const request of requests) {
      try {
        const alias = await this.generateAlias(request);
        results.push(alias);
      } catch (error) {
        console.error(`Failed to generate alias for ${request.symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Get trending aliases
   */
  getTrendingAliases(timeframe: 'hour' | 'day' | 'week' | 'month', limit: number = 10): VTSAlias[] {
    const now = new Date();
    const cutoffTime = new Date();

    switch (timeframe) {
      case 'hour':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case 'day':
        cutoffTime.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffTime.setMonth(now.getMonth() - 1);
        break;
    }

    return Array.from(this.aliases.values())
      .filter(alias =>
        alias.status === AliasStatus.ACTIVE &&
        alias.lastAccessed &&
        alias.lastAccessed >= cutoffTime
      )
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, limit);
  }

  /**
   * Cleanup expired aliases
   */
  cleanupExpiredAliases(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [alias, vtsAlias] of this.aliases) {
      if (vtsAlias.expiresAt && vtsAlias.expiresAt < now) {
        vtsAlias.status = AliasStatus.EXPIRED;
        cleaned++;
      }
    }

    return cleaned;
  }

  // Private helper methods

  private isValidSymbol(symbol: string): boolean {
    // Check VTS symbol format: V:REGION:CAT:TOPIC_ID
    const pattern = /^V:[A-Z]{2,3}:[A-Z]{3}:[A-Z0-9]{8}$/;
    return pattern.test(symbol);
  }

  private generateHumanReadableAlias(request: AliasGenerationRequest): string {
    // Extract components from symbol
    const parts = request.symbol.split(':');
    if (parts.length !== 4) {
      return this.generateRandomAlias();
    }

    const [, region, category, topicId] = parts;

    // Create human-readable components
    const regionName = this.getRegionName(region);
    const categoryName = this.getCategoryName(category);
    const topicName = this.generateTopicName(topicId, request.metadata.description);

    // Combine into readable alias
    const components = [topicName];

    if (request.type === AliasType.SEO_FRIENDLY) {
      components.push(categoryName.toLowerCase());
    }

    if (region !== 'GLB') {
      components.push(regionName.toLowerCase());
    }

    // Clean up and format
    let alias = components.join('-');
    alias = alias.replace(/[^a-zA-Z0-9\-]/g, '');
    alias = alias.replace(/-+/g, '-');
    alias = alias.toLowerCase();

    return alias;
  }

  private generateTopicName(topicId: string, description?: string): string {
    if (description) {
      // Extract keywords from description
      const words = description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 3);

      if (words.length > 0) {
        return words.join('-');
      }
    }

    // Fallback to topic ID with some transformation
    return `topic-${topicId.substring(0, 4).toLowerCase()}`;
  }

  private getRegionName(regionCode: string): string {
    const regionNames: Record<string, string> = {
      'GLB': 'Global',
      'ZA': 'SouthAfrica',
      'NG': 'Nigeria',
      'US': 'USA',
      'GB': 'UK',
      'AU': 'Australia',
      'CA': 'Canada',
      'DE': 'Germany',
      'FR': 'France',
      'JP': 'Japan',
      'CN': 'China',
      'IN': 'India',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'ES': 'Spain',
      'IT': 'Italy',
      'KR': 'Korea',
      'NL': 'Netherlands',
      'SG': 'Singapore'
    };

    return regionNames[regionCode] || regionCode;
  }

  private getCategoryName(categoryCode: string): string {
    const categoryNames: Record<string, string> = {
      'POL': 'Politics',
      'ENT': 'Entertainment',
      'SPT': 'Sports',
      'TEC': 'Technology',
      'CUL': 'Culture',
      'FIN': 'Finance',
      'SAF': 'Safety',
      'EDU': 'Education',
      'MSC': 'Misc',
      'HLT': 'Health',
      'SCI': 'Science',
      'BIZ': 'Business',
      'LIF': 'Lifestyle',
      'TRV': 'Travel',
      'FOD': 'Food',
      'ENV': 'Environment',
      'CRM': 'Crime'
    };

    return categoryNames[categoryCode] || categoryCode;
  }

  private generateRandomAlias(): string {
    return `alias-${Math.random().toString(36).substring(2, 8)}`;
  }

  private async ensureUniqueAlias(alias: string): Promise<string> {
    let uniqueAlias = alias;
    let counter = 1;

    while (this.aliases.has(uniqueAlias)) {
      uniqueAlias = `${alias}-${counter}`;
      counter++;
    }

    return uniqueAlias;
  }

  private trackAliasAccess(alias: VTSAlias): void {
    alias.clickCount++;
    alias.lastAccessed = new Date();

    // Update analytics
    const analytics = this.aliasAnalytics.get(alias.id);
    if (analytics) {
      analytics.totalClicks++;

      // Add temporal data point
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let temporalData = analytics.temporalData.find(d =>
        d.date.getTime() === today.getTime()
      );

      if (!temporalData) {
        temporalData = {
          date: today,
          clicks: 0,
          uniqueVisitors: 0
        };
        analytics.temporalData.push(temporalData);
      }

      temporalData.clicks++;
    }
  }

  private matchesFilters(alias: VTSAlias, filters?: AliasSearchFilters): boolean {
    if (!filters) return true;

    if (filters.type && alias.type !== filters.type) return false;
    if (filters.createdBy && alias.createdBy !== filters.createdBy) return false;
    if (filters.tags && !filters.tags.some(tag => alias.metadata.tags.includes(tag))) return false;
    if (filters.minClicks && alias.clickCount < filters.minClicks) return false;

    return true;
  }

  private calculateRelevanceScore(alias: VTSAlias, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Exact alias match
    if (alias.alias.toLowerCase() === queryLower) {
      score += 100;
    }

    // Alias starts with query
    if (alias.alias.toLowerCase().startsWith(queryLower)) {
      score += 50;
    }

    // Description match
    if (alias.metadata.description.toLowerCase().includes(queryLower)) {
      score += 30;
    }

    // Tag match
    if (alias.metadata.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
      score += 20;
    }

    // Symbol match
    if (alias.symbol.toLowerCase().includes(queryLower)) {
      score += 15;
    }

    // Popularity boost
    score += Math.min(alias.clickCount / 10, 20);

    // Recent access boost
    if (alias.lastAccessed) {
      const daysSinceAccess = (Date.now() - alias.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(10 - daysSinceAccess, 0);
    }

    return score;
  }

  private generateAliasId(): string {
    return 'alias_' + createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
  }
}

// Supporting interfaces
export interface AliasSearchFilters {
  type?: AliasType;
  createdBy?: string;
  tags?: string[];
  minClicks?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

class ShortUrlGenerator {
  private urlMap: Map<string, string> = new Map();
  private reverseMap: Map<string, string> = new Map();

  async generateShortUrl(alias: string): Promise<string> {
    // Check if already exists
    if (this.reverseMap.has(alias)) {
      return this.reverseMap.get(alias)!;
    }

    // Generate short code
    const shortCode = this.generateShortCode(alias);
    const shortUrl = `https://vts.viralfx.com/${shortCode}`;

    // Store mapping
    this.urlMap.set(shortCode, alias);
    this.reverseMap.set(alias, shortUrl);

    return shortUrl;
  }

  private generateShortCode(alias: string): string {
    const hash = createHash('md5').update(alias).digest('base64');
    return hash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
  }

  resolveShortUrl(shortUrl: string): string | null {
    const shortCode = shortUrl.split('/').pop();
    if (!shortCode) return null;

    return this.urlMap.get(shortCode) || null;
  }
}