/**
 * ViralFX Universal Trend Symbol System (VTS-Code)
 * Globally scalable, non-SA-restricted, cross-platform, verifiable trend indexing
 * © 2025 ViralFX - Global Symbol Standard
 */

import { createHash } from 'crypto';
import { logger } from "./logger";

// Region codes (ISO-3166 2-letter + special codes)
export enum RegionCode {
  GLOBAL = 'GLB',
  SOUTH_AFRICA = 'ZA',
  NIGERIA = 'NG',
  USA = 'US',
  UK = 'GB',
  AUSTRALIA = 'AU',
  CANADA = 'CA',
  GERMANY = 'DE',
  FRANCE = 'FR',
  JAPAN = 'JP',
  CHINA = 'CN',
  INDIA = 'IN',
  BRAZIL = 'BR',
  MEXICO = 'MX',
  SPAIN = 'ES',
  ITALY = 'IT',
  SOUTH_KOREA = 'KR',
  NETHERLANDS = 'NL',
  SINGAPORE = 'SG'
  // Add more as needed for global expansion
}

// Category codes
export enum CategoryCode {
  POLITICS = 'POL',
  ENTERTAINMENT = 'ENT',
  SPORTS = 'SPT',
  TECHNOLOGY = 'TEC',
  CULTURE = 'CUL',
  FINANCE = 'FIN',
  SAFETY = 'SAF',
  EDUCATION = 'EDU',
  MISC = 'MSC',
  HEALTH = 'HLT',
  SCIENCE = 'SCI',
  BUSINESS = 'BIZ',
  LIFESTYLE = 'LIF',
  TRAVEL = 'TRV',
  FOOD = 'FOD',
  ENVIRONMENT = 'ENV',
  CRIME = 'CRM' // High verification required
}

export interface VTSSymbol {
  symbol: string;
  region: RegionCode;
  category: CategoryCode;
  topicId: string;
  displayName: string;
  description: string;
  metadata: VTSMetadata;
}

export interface VTSMetadata {
  originalTopic: string;
  hashRoot: string;
  createdAt: Date;
  platforms: string[];
  verificationLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
  sentimentScore: number;
  viralityScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  languages: string[];
  firstSeenPlatform: string;
  consensusScore: number;
}

export class VTSSymbolGenerator {
  private static readonly SYMBOL_PREFIX = 'V';
  private static readonly TOPIC_ID_LENGTH = 8;

  /**
   * Generate a VTS symbol for a trend
   */
  static generateSymbol(
    region: RegionCode,
    category: CategoryCode,
    topic: string,
    metadata: Partial<VTSMetadata>
  ): VTSSymbol {
    // Generate unique topic ID
    const topicId = this.generateTopicId(topic);

    // Construct symbol
    const symbol = `${this.SYMBOL_PREFIX}:${region}:${category}:${topicId}`;

    return {
      symbol,
      region,
      category,
      topicId,
      displayName: this.generateDisplayName(topic, category),
      description: this.generateDescription(topic, category, region),
      metadata: {
        originalTopic: topic,
        hashRoot: this.generateHashRoot(topic),
        createdAt: new Date(),
        platforms: metadata.platforms || [],
        verificationLevel: metadata.verificationLevel || 'LOW',
        sentimentScore: metadata.sentimentScore || 0,
        viralityScore: metadata.viralityScore || 0,
        riskLevel: metadata.riskLevel || 'LOW',
        languages: metadata.languages || ['en'],
        firstSeenPlatform: metadata.firstSeenPlatform || 'unknown',
        consensusScore: metadata.consensusScore || 0
      }
    };
  }

  /**
   * Generate unique topic ID from topic name
   */
  private static generateTopicId(topic: string): string {
    // Normalize topic: uppercase, remove special chars, compress
    const normalized = topic
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Remove vowels for compression (keeping some readability)
    const compressed = normalized
      .replace(/[AEIOU]/g, '')
      .substring(0, 6); // Take first 6 consonants

    // Generate hash for uniqueness
    const hash = createHash('sha256')
      .update(topic)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();

    // Combine compressed topic with hash
    const topicId = `${compressed}${hash}`.substring(0, this.TOPIC_ID_LENGTH);

    // Ensure minimum length
    return topicId.padEnd(this.TOPIC_ID_LENGTH, 'X');
  }

  /**
   * Generate hash root for topic
   */
  private static generateHashRoot(topic: string): string {
    return createHash('sha256')
      .update(topic.toLowerCase())
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
  }

  /**
   * Generate human-readable display name
   */
  private static generateDisplayName(topic: string, category: CategoryCode): string {
    const maxLength = 50;
    if (topic.length <= maxLength) {
      return topic;
    }

    // Truncate intelligently
    return topic.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate description
   */
  private static generateDescription(topic: string, category: CategoryCode, region: RegionCode): string {
    const categoryName = this.getCategoryName(category);
    const regionName = this.getRegionName(region);

    return `${categoryName} trend: ${topic} trending in ${regionName}`;
  }

  /**
   * Parse existing symbol
   */
  static parseSymbol(symbol: string): Partial<VTSSymbol> | null {
    const pattern = /^V:([A-Z]{2,3}):([A-Z]{3}):([A-Z0-9]{8})$/;
    const match = symbol.match(pattern);

    if (!match) {
      return null;
    }

    const [, region, category, topicId] = match;

    return {
      symbol,
      region: region as RegionCode,
      category: category as CategoryCode,
      topicId
    };
  }

  /**
   * Validate symbol format
   */
  static validateSymbol(symbol: string): boolean {
    const pattern = /^V:[A-Z]{2,3}:[A-Z]{3}:[A-Z0-9]{8}$/;
    return pattern.test(symbol);
  }

  /**
   * Get category name from code
   */
  static getCategoryName(category: CategoryCode): string {
    const categoryNames = {
      [CategoryCode.POLITICS]: 'Politics',
      [CategoryCode.ENTERTAINMENT]: 'Entertainment',
      [CategoryCode.SPORTS]: 'Sports',
      [CategoryCode.TECHNOLOGY]: 'Technology',
      [CategoryCode.CULTURE]: 'Culture',
      [CategoryCode.FINANCE]: 'Finance',
      [CategoryCode.SAFETY]: 'Safety',
      [CategoryCode.EDUCATION]: 'Education',
      [CategoryCode.MISC]: 'Miscellaneous',
      [CategoryCode.HEALTH]: 'Health',
      [CategoryCode.SCIENCE]: 'Science',
      [CategoryCode.BUSINESS]: 'Business',
      [CategoryCode.LIFESTYLE]: 'Lifestyle',
      [CategoryCode.TRAVEL]: 'Travel',
      [CategoryCode.FOOD]: 'Food',
      [CategoryCode.ENVIRONMENT]: 'Environment',
      [CategoryCode.CRIME]: 'Crime'
    };

    return categoryNames[category] || 'Unknown';
  }

  /**
   * Get region name from code
   */
  static getRegionName(region: RegionCode): string {
    const regionNames = {
      [RegionCode.GLOBAL]: 'Global',
      [RegionCode.SOUTH_AFRICA]: 'South Africa',
      [RegionCode.NIGERIA]: 'Nigeria',
      [RegionCode.USA]: 'United States',
      [RegionCode.UK]: 'United Kingdom',
      [RegionCode.AUSTRALIA]: 'Australia',
      [RegionCode.CANADA]: 'Canada',
      [RegionCode.GERMANY]: 'Germany',
      [RegionCode.FRANCE]: 'France',
      [RegionCode.JAPAN]: 'Japan',
      [RegionCode.CHINA]: 'China',
      [RegionCode.INDIA]: 'India',
      [RegionCode.BRAZIL]: 'Brazil',
      [RegionCode.MEXICO]: 'Mexico',
      [RegionCode.SPAIN]: 'Spain',
      [RegionCode.ITALY]: 'Italy',
      [RegionCode.SOUTH_KOREA]: 'South Korea',
      [RegionCode.NETHERLANDS]: 'Netherlands',
      [RegionCode.SINGAPORE]: 'Singapore'
    };

    return regionNames[region] || 'Unknown';
  }

  /**
   * Get symbols by region prefix
   */
  static getSymbolsByRegion(symbols: string[], region: RegionCode): string[] {
    const prefix = `${this.SYMBOL_PREFIX}:${region}:`;
    return symbols.filter(symbol => symbol.startsWith(prefix));
  }

  /**
   * Get symbols by category prefix
   */
  static getSymbolsByCategory(symbols: string[], category: CategoryCode): string[] {
    const prefix = `${this.SYMBOL_PREFIX}::${category}:`;
    return symbols.filter(symbol => {
      const parts = symbol.split(':');
      return parts.length === 4 && parts[2] === category;
    });
  }

  /**
   * Get symbol color by category
   */
  static getCategoryColor(category: CategoryCode): string {
    const colors = {
      [CategoryCode.POLITICS]: '#dc2626', // red-600
      [CategoryCode.ENTERTAINMENT]: '#7c3aed', // violet-600
      [CategoryCode.SPORTS]: '#059669', // emerald-600
      [CategoryCode.TECHNOLOGY]: '#2563eb', // blue-600
      [CategoryCode.CULTURE]: '#ea580c', // orange-600
      [CategoryCode.FINANCE]: '#16a34a', // green-600
      [CategoryCode.SAFETY]: '#dc2626', // red-600
      [CategoryCode.EDUCATION]: '#7c2d12', // amber-800
      [CategoryCode.MISC]: '#6b7280', // gray-500
      [CategoryCode.HEALTH]: '#be123c', // pink-700
      [CategoryCode.SCIENCE]: '#1e40af', // blue-800
      [CategoryCode.BUSINESS]: '#15803d', // green-700
      [CategoryCode.LIFESTYLE]: '#c2410c', // orange-700
      [CategoryCode.TRAVEL]: '#0891b2', // cyan-600
      [CategoryCode.FOOD]: '#b91c1c', // red-700
      [CategoryCode.ENVIRONMENT]: '#166534', // green-700
      [CategoryCode.CRIME]: '#7f1d1d' // red-900
    };

    return colors[category] || '#6b7280';
  }

  /**
   * Check if two symbols are from the same topic
   */
  static areSameTopic(symbol1: string, symbol2: string): boolean {
    const parsed1 = this.parseSymbol(symbol1);
    const parsed2 = this.parseSymbol(symbol2);

    if (!parsed1 || !parsed2) {
      return false;
    }

    // Same topic if they have the same topic ID
    return parsed1.topicId === parsed2.topicId;
  }

  /**
   * Generate search index for symbols
   */
  static generateSearchIndex(symbols: VTSSymbol[]): Map<string, VTSSymbol[]> {
    const searchIndex = new Map<string, VTSSymbol[]>();

    symbols.forEach(symbol => {
      const searchTerms = [
        symbol.symbol.toLowerCase(),
        symbol.displayName.toLowerCase(),
        symbol.description.toLowerCase(),
        symbol.metadata.originalTopic.toLowerCase(),
        symbol.region.toLowerCase(),
        symbol.category.toLowerCase(),
      ];

      searchTerms.forEach(term => {
        if (!searchIndex.has(term)) {
          searchIndex.set(term, []);
        }
        searchIndex.get(term)!.push(symbol);
      });
    });

    return searchIndex;
  }

  /**
   * Search symbols
   */
  static searchSymbols(
    symbols: VTSSymbol[],
    query: string,
    filters?: {
      region?: RegionCode;
      category?: CategoryCode;
      verificationLevel?: string;
    }
  ): VTSSymbol[] {
    let results = symbols.filter(symbol =>
      symbol.displayName.toLowerCase().includes(query.toLowerCase()) ||
      symbol.description.toLowerCase().includes(query.toLowerCase()) ||
      symbol.metadata.originalTopic.toLowerCase().includes(query.toLowerCase())
    );

    if (filters?.region) {
      results = results.filter(symbol => symbol.region === filters.region);
    }

    if (filters?.category) {
      results = results.filter(symbol => symbol.category === filters.category);
    }

    if (filters?.verificationLevel) {
      results = results.filter(symbol =>
        symbol.metadata.verificationLevel === filters.verificationLevel
      );
    }

    return results;
  }

  /**
   * Generate trending symbol suggestions
   */
  static generateTrendingSuggestions(symbols: VTSSymbol[]): string[] {
    return symbols
      .filter(symbol => symbol.metadata.viralityScore > 0.7)
      .sort((a, b) => b.metadata.viralityScore - a.metadata.viralityScore)
      .slice(0, 10)
      .map(symbol => symbol.symbol);
  }
}
