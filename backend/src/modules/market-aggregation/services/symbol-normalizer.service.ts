import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SymbolNormalizerService {
  private readonly logger = new Logger(SymbolNormalizerService.name);

  constructor(private config: ConfigService) {}

  /**
   * Normalize topic to trading symbol format
   * Examples:
   * "DJ Zinhle dance challenge" → "VIRAL/SA_DJ_ZINHLE_001"
   * "Bitcoin price spike" → "VIRAL/SA_CRYPTO_BTC_001"
   * "Springboks win" → "VIRAL/SA_SPORTS_SPRINGBOKS_001"
   */
  normalizeTopicToSymbol(topic: {
    title: string;
    category: string;
    platform: string;
    region: string;
    keywords: string[];
  }): string {
    try {
      const normalized = this.normalizeTitle(topic.title);
      const category = this.mapCategory(topic.category);
      const region = topic.region || 'SA';
      const identifier = this.generateIdentifier(normalized, topic.platform);

      return `VIRAL/${region}_${category}_${normalized}_${identifier}`;
    } catch (error) {
      this.logger.error('Failed to normalize topic to symbol:', error);
      // Fallback symbol
      return `VIRAL/SA_TREND_${Date.now()}`;
    }
  }

  /**
   * Parse symbol back to components
   */
  parseSymbol(symbol: string): {
    prefix: string;
    region: string;
    category: string;
    name: string;
    identifier: string;
  } | null {
    try {
      const parts = symbol.split('/');
      if (parts.length !== 2 || parts[0] !== 'VIRAL') {
        return null;
      }

      const metadata = parts[1].split('_');
      if (metadata.length < 3) {
        return null;
      }

      return {
        prefix: parts[0],
        region: metadata[0],
        category: metadata[1],
        name: metadata.slice(2, -1).join('_'),
        identifier: metadata[metadata.length - 1]
      };
    } catch (error) {
      this.logger.error('Failed to parse symbol:', error);
      return null;
    }
  }

  /**
   * Check if symbol follows ViralFX format
   */
  isValidViralFXSymbol(symbol: string): boolean {
    return /^VIRAL\/[A-Z]{2}_[A-Z]+_[A-Z0-9]+_\d{3}$/.test(symbol);
  }

  /**
   * Generate unique identifier for symbol
   */
  private generateIdentifier(normalizedName: string, platform: string): string {
    const hash = this.createHash(normalizedName + platform + Date.now());
    return (hash % 1000).toString().padStart(3, '0');
  }

  /**
   * Normalize title for symbol
   */
  private normalizeTitle(title: string): string {
    return title
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters except spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2}/g, '_') // Remove multiple underscores
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 20); // Limit length
  }

  /**
   * Map category to symbol category
   */
  private mapCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      'celebrity': 'CELEB',
      'brand': 'BRAND',
      'education': 'EDU',
      'politics': 'POLITICS',
      'entertainment': 'ENTERTAIN',
      'sports': 'SPORTS',
      'crypto': 'CRYPTO',
      'finance': 'FINANCE',
      'tech': 'TECH',
      'lifestyle': 'LIFESTYLE',
      'news': 'NEWS',
      'memes': 'MEMES',
      'challenges': 'CHALLENGES',
      'viral': 'VIRAL'
    };

    return categoryMap[category.toLowerCase()] || 'TREND';
  }

  /**
   * Create simple hash for identifier
   */
  private createHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get symbol metadata from database
   */
  async getSymbolMetadata(symbol: string): Promise<{
    name: string;
    category: string;
    region: string;
    description: string;
    keywords: string[];
    platforms: string[];
    createdAt: Date;
  } | null> {
    try {
      // This would typically query the database
      // For now, return parsed metadata
      const parsed = this.parseSymbol(symbol);
      if (!parsed) {
        return null;
      }

      return {
        name: parsed.name.replace(/_/g, ' '),
        category: parsed.category,
        region: parsed.region,
        description: `Viral trend ${parsed.name}`,
        keywords: [],
        platforms: [],
        createdAt: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to get symbol metadata:', error);
      return null;
    }
  }

  /**
   * Search for symbols by topic
   */
  searchSymbols(query: string, filters?: {
    category?: string;
    region?: string;
    limit?: number;
  }): Promise<Array<{
    symbol: string;
    name: string;
    category: string;
    relevanceScore: number;
  }>> {
    try {
      // This would typically search the database
      // For now, return mock results
      const mockResults = [
        {
          symbol: 'VIRAL/SA_CELEB_DJ_ZINHLE_001',
          name: 'DJ Zinhle',
          category: 'CELEB',
          relevanceScore: 0.95
        },
        {
          symbol: 'VIRAL/SA_ENTERTAIN_DANCE_CHALLENGE_002',
          name: 'Dance Challenge',
          category: 'ENTERTAIN',
          relevanceScore: 0.87
        }
      ];

      return mockResults.filter(result =>
        result.name.toLowerCase().includes(query.toLowerCase()) &&
        (!filters?.category || result.category === filters.category) &&
        (!filters?.region || result.symbol.includes(filters.region))
      ).slice(0, filters?.limit || 10);
    } catch (error) {
      this.logger.error('Failed to search symbols:', error);
      return [];
    }
  }

  /**
   * Validate symbol before creation
   */
  validateSymbolComponents(components: {
    title: string;
    category: string;
    platform: string;
    region: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!components.title || components.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!components.category || components.category.trim().length === 0) {
      errors.push('Category is required');
    }

    if (!components.platform) {
      errors.push('Platform is required');
    }

    if (!components.region || !/^[A-Z]{2}$/.test(components.region)) {
      errors.push('Valid region code is required (2-letter ISO code)');
    }

    if (components.title.length > 100) {
      errors.push('Title is too long (max 100 characters)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate alternative symbols if primary exists
   */
  generateAlternativeSymbols(baseSymbol: string, count: number = 3): string[] {
    const alternatives: string[] = [];
    const parsed = this.parseSymbol(baseSymbol);

    if (!parsed) {
      return alternatives;
    }

    for (let i = 1; i <= count; i++) {
      const newIdentifier = (parseInt(parsed.identifier) + i).toString().padStart(3, '0');
      alternatives.push(`VIRAL/${parsed.region}_${parsed.category}_${parsed.name}_${newIdentifier}`);
    }

    return alternatives;
  }

  /**
   * Check if symbol already exists
   */
  async symbolExists(symbol: string): Promise<boolean> {
    try {
      // This would typically check the database
      // For now, check format validity only
      return this.isValidViralFXSymbol(symbol);
    } catch (error) {
      this.logger.error('Failed to check if symbol exists:', error);
      return false;
    }
  }
}
