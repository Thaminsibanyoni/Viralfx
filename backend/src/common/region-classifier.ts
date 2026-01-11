/**
 * ViralFX Region Classifier
 * Automatically detects and classifies content by geographic region
 * © 2025 ViralFX - Global Intelligence System
 */

import { RegionCode } from "./symbol-generator";

export interface RegionDetection {
  region: RegionCode;
  confidence: number;
  indicators: RegionIndicator[];
}

export interface RegionIndicator {
  type: 'language' | 'location' | 'currency' | 'platform' | 'cultural';
  value: string;
  weight: number;
}

export class RegionClassifier {
  private static readonly LANGUAGE_REGION_MAP: Record<string, RegionCode[]> = {
    'en': [RegionCode.USA, RegionCode.UK, RegionCode.SOUTH_AFRICA, RegionCode.AUSTRALIA, RegionCode.CANADA],
    'af': [RegionCode.SOUTH_AFRICA],
    'zu': [RegionCode.SOUTH_AFRICA],
    'xh': [RegionCode.SOUTH_AFRICA],
    'ha': [RegionCode.NIGERIA],
    'yo': [RegionCode.NIGERIA],
    'ig': [RegionCode.NIGERIA],
    'es': [RegionCode.SPAIN, RegionCode.MEXICO],
    'fr': [RegionCode.FRANCE],
    'de': [RegionCode.GERMANY],
    'ja': [RegionCode.JAPAN],
    'ko': [RegionCode.SOUTH_KOREA],
    'zh': [RegionCode.CHINA],
    'hi': [RegionCode.INDIA],
    'pt': [RegionCode.BRAZIL],
    'nl': [RegionCode.NETHERLANDS],
    'it': [RegionCode.ITALY]
  };

  private static readonly LOCATION_KEYWORDS: Record<string, RegionCode> = {
    // South Africa
    'johannesburg': RegionCode.SOUTH_AFRICA,
    'cape town': RegionCode.SOUTH_AFRICA,
    'pretoria': RegionCode.SOUTH_AFRICA,
    'durban': RegionCode.SOUTH_AFRICA,
    'soweto': RegionCode.SOUTH_AFRICA,
    'mzansi': RegionCode.SOUTH_AFRICA,
    'loadshedding': RegionCode.SOUTH_AFRICA,

    // Nigeria
    'lagos': RegionCode.NIGERIA,
    'abuja': RegionCode.NIGERIA,
    'kano': RegionCode.NIGERIA,
    'naija': RegionCode.NIGERIA,

    // USA
    'new york': RegionCode.USA,
    'los angeles': RegionCode.USA,
    'chicago': RegionCode.USA,
    'washington': RegionCode.USA,
    'america': RegionCode.USA,

    // UK
    'london': RegionCode.UK,
    'manchester': RegionCode.UK,
    'britain': RegionCode.UK,
    'england': RegionCode.UK,

    // Other major cities
    'tokyo': RegionCode.JAPAN,
    'seoul': RegionCode.SOUTH_KOREA,
    'beijing': RegionCode.CHINA,
    'mumbai': RegionCode.INDIA,
    'sydney': RegionCode.AUSTRALIA,
    'toronto': RegionCode.CANADA,
    'paris': RegionCode.FRANCE,
    'berlin': RegionCode.GERMANY
  };

  private static readonly CURRENCY_INDICATORS: Record<string, RegionCode> = {
    'zar': RegionCode.SOUTH_AFRICA,
    'rand': RegionCode.SOUTH_AFRICA,
    'r': RegionCode.SOUTH_AFRICA,
    'ngn': RegionCode.NIGERIA,
    'naira': RegionCode.NIGERIA,
    '₦': RegionCode.NIGERIA,
    'usd': RegionCode.USA,
    '$': RegionCode.USA,
    'gbp': RegionCode.UK,
    '£': RegionCode.UK,
    'eur': RegionCode.FRANCE, // Default to France for Euro
    '€': RegionCode.FRANCE,
    'jpy': RegionCode.JAPAN,
    '¥': RegionCode.JAPAN,
    'aud': RegionCode.AUSTRALIA,
    'cad': RegionCode.CANADA,
    'cny': RegionCode.CHINA,
    'inr': RegionCode.INDIA
  };

  private static readonly PLATFORM_REGION_MAPPING: Record<string, RegionCode[]> = {
    'twitter.com': [RegionCode.USA, RegionCode.GLOBAL],
    'x.com': [RegionCode.USA, RegionCode.GLOBAL],
    'tiktok.com': [RegionCode.CHINA, RegionCode.GLOBAL],
    'instagram.com': [RegionCode.USA, RegionCode.GLOBAL],
    'facebook.com': [RegionCode.USA, RegionCode.GLOBAL],
    'youtube.com': [RegionCode.USA, RegionCode.GLOBAL],
    'linkedin.com': [RegionCode.USA, RegionCode.GLOBAL],
    'reddit.com': [RegionCode.USA, RegionCode.GLOBAL],
    'news24.com': [RegionCode.SOUTH_AFRICA],
    'iol.co.za': [RegionCode.SOUTH_AFRICA],
    'timeslive.co.za': [RegionCode.SOUTH_AFRICA],
    'guardian.ng': [RegionCode.NIGERIA],
    'punchng.com': [RegionCode.NIGERIA],
    'cnn.com': [RegionCode.USA],
    'bbc.co.uk': [RegionCode.UK],
    'foxnews.com': [RegionCode.USA]
  };

  private static readonly CULTURAL_INDICATORS: Record<string, RegionCode[]> = {
    // South African cultural indicators
    'soweto': [RegionCode.SOUTH_AFRICA],
    'mandela': [RegionCode.SOUTH_AFRICA],
    'bafana': [RegionCode.SOUTH_AFRICA],
    'proteas': [RegionCode.SOUTH_AFRICA],
    'springboks': [RegionCode.SOUTH_AFRICA],
    'shwashwi': [RegionCode.SOUTH_AFRICA],
    'lekgotla': [RegionCode.SOUTH_AFRICA],
    'boerewors': [RegionCode.SOUTH_AFRICA],
    'biltong': [RegionCode.SOUTH_AFRICA],

    // Nigerian cultural indicators
    'nollywood': [RegionCode.NIGERIA],
    'afrobeats': [RegionCode.NIGERIA],
    'wazobia': [RegionCode.NIGERIA],
    'naija': [RegionCode.NIGERIA],

    // American cultural indicators
    'super bowl': [RegionCode.USA],
    'thanksgiving': [RegionCode.USA],
    '4th of july': [RegionCode.USA],
    'wall street': [RegionCode.USA],

    // British cultural indicators
    'premier league': [RegionCode.UK],
    'royal family': [RegionCode.UK],
    'tea time': [RegionCode.UK]
  };

  /**
   * Detect region from content
   */
  static detectRegion(content: {
    text: string;
    language?: string;
    platform?: string;
    userLocation?: string;
    mentions?: string[];
    hashtags?: string[];
  }): RegionDetection {
    const indicators: RegionIndicator[] = [];
    const text = content.text.toLowerCase();

    // Language detection
    if (content.language) {
      const possibleRegions = this.LANGUAGE_REGION_MAP[content.language];
      if (possibleRegions) {
        possibleRegions.forEach(region => {
          indicators.push({
            type: 'language',
            value: content.language!,
            weight: 0.3
          });
        });
      }
    }

    // Location keyword detection
    Object.entries(this.LOCATION_KEYWORDS).forEach(([keyword, region]) => {
      if (text.includes(keyword)) {
        indicators.push({
          type: 'location',
          value: keyword,
          weight: 0.4
        });
      }
    });

    // Currency detection
    Object.entries(this.CURRENCY_INDICATORS).forEach(([symbol, region]) => {
      if (text.includes(symbol)) {
        indicators.push({
          type: 'currency',
          value: symbol,
          weight: 0.3
        });
      }
    });

    // Platform detection
    if (content.platform) {
      const possibleRegions = this.PLATFORM_REGION_MAPPING[content.platform];
      if (possibleRegions) {
        possibleRegions.forEach(region => {
          indicators.push({
            type: 'platform',
            value: content.platform!,
            weight: 0.2
          });
        });
      }
    }

    // Cultural indicator detection
    Object.entries(this.CULTURAL_INDICATORS).forEach(([indicator, regions]) => {
      if (text.includes(indicator)) {
        regions.forEach(region => {
          indicators.push({
            type: 'cultural',
            value: indicator,
            weight: 0.5
          });
        });
      }
    });

    // User location (if provided)
    if (content.userLocation) {
      const locationIndicators = this.detectFromLocation(content.userLocation);
      indicators.push(...locationIndicators);
    }

    // Mentions and hashtags
    if (content.mentions) {
      content.mentions.forEach(mention => {
        const mentionIndicators = this.detectFromText(mention);
        indicators.push(...mentionIndicators);
      });
    }

    if (content.hashtags) {
      content.hashtags.forEach(hashtag => {
        const hashtagIndicators = this.detectFromText(hashtag);
        indicators.push(...hashtagIndicators);
      });
    }

    return this.aggregateRegionIndicators(indicators);
  }

  /**
   * Detect region from location string
   */
  private static detectFromLocation(location: string): RegionIndicator[] {
    const indicators: RegionIndicator[] = [];
    const normalizedLocation = location.toLowerCase();

    Object.entries(this.LOCATION_KEYWORDS).forEach(([keyword, region]) => {
      if (normalizedLocation.includes(keyword)) {
        indicators.push({
          type: 'location',
          value: keyword,
          weight: 0.6 // Higher weight for explicit location
        });
      }
    });

    return indicators;
  }

  /**
   * Detect region from text
   */
  private static detectFromText(text: string): RegionIndicator[] {
    const indicators: RegionIndicator[] = [];
    const normalizedText = text.toLowerCase();

    Object.entries(this.LOCATION_KEYWORDS).forEach(([keyword, region]) => {
      if (normalizedText.includes(keyword)) {
        indicators.push({
          type: 'location',
          value: keyword,
          weight: 0.3
        });
      }
    });

    Object.entries(this.CURRENCY_INDICATORS).forEach(([symbol, region]) => {
      if (normalizedText.includes(symbol)) {
        indicators.push({
          type: 'currency',
          value: symbol,
          weight: 0.3
        });
      }
    });

    return indicators;
  }

  /**
   * Aggregate indicators to determine most likely region
   */
  private static aggregateRegionIndicators(indicators: RegionIndicator[]): RegionDetection {
    const regionScores = new Map<RegionCode, number>();

    indicators.forEach(indicator => {
      const currentScore = regionScores.get(indicator.type as any) || 0;
      regionScores.set(indicator.type as any, currentScore + indicator.weight);
    });

    if (regionScores.size === 0) {
      return {
        region: RegionCode.GLOBAL,
        confidence: 0.1,
        indicators: []
      };
    }

    // Find region with highest score
    let maxScore = 0;
    let detectedRegion = RegionCode.GLOBAL;

    regionScores.forEach((score, region) => {
      if (score > maxScore) {
        maxScore = score;
        detectedRegion = region;
      }
    });

    // Calculate confidence based on score distribution
    const totalScore = Array.from(regionScores.values()).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.1;

    return {
      region: detectedRegion,
      confidence: Math.min(confidence, 1.0),
      indicators
    };
  }

  /**
   * Get region-specific keywords for enhanced detection
   */
  static getRegionKeywords(region: RegionCode): string[] {
    const keywordMap: Record<RegionCode, string[]> = {
      [RegionCode.SOUTH_AFRICA]: [
        'south africa', 'sa', 'mzansi', 'johannesburg', 'cape town', 'pretoria',
        'loadshedding', 'eskom', 'zuma', 'ramaphosa', 'anc', 'da', 'eff',
        'bafana bafana', 'springboks', 'proteas', 'soweto', 'township',
        'zikode', 'afro', 'gqom', 'amapiano'
      ],
      [RegionCode.NIGERIA]: [
        'nigeria', 'naija', 'lagos', 'abuja', 'kano', 'port harcourt',
        'buhari', 'tinubu', 'nollywood', 'afrobeats', 'burna boy', 'wizkid',
        'peter obi', 'atiku', 'inec', 'naira', 'japa'
      ],
      [RegionCode.USA]: [
        'america', 'usa', 'united states', 'washington', 'new york', 'california',
        'biden', 'trump', 'white house', 'congress', 'supreme court', 'wall street',
        'silicon valley', 'hollywood', 'nfl', 'nba', 'mlb'
      ],
      [RegionCode.UK]: [
        'britain', 'uk', 'england', 'london', 'manchester', 'british',
        'westminster', 'downing street', 'premier league', 'bbc', 'royal family',
        'brexit', 'theresa may', 'boris johnson', 'keir starmer'
      ],
      [RegionCode.GLOBAL]: [
        'world', 'global', 'international', 'united nations', 'who', 'un',
        'climate change', 'covid', 'pandemic', 'global economy'
      ]
    };

    return keywordMap[region] || [];
  }

  /**
   * Validate region detection accuracy
   */
  static validateDetection(
    detection: RegionDetection,
    knownRegion?: RegionCode
  ): boolean {
    if (!knownRegion) {
      return detection.confidence > 0.5;
    }

    return detection.region === knownRegion && detection.confidence > 0.3;
  }

  /**
   * Get fallback region when confidence is low
   */
  static getFallbackRegion(): RegionCode {
    return RegionCode.GLOBAL;
  }
}
