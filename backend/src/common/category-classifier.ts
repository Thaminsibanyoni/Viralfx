/**
 * ViralFX Category Classifier
 * Automatically classifies content into predefined categories
 * © 2025 ViralFX - Content Classification System
 */

import { CategoryCode } from "./symbol-generator";

export interface CategoryDetection {
  category: CategoryCode;
  confidence: number;
  indicators: CategoryIndicator[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CategoryIndicator {
  type: 'keyword' | 'sentiment' | 'entity' | 'platform' | 'engagement';
  value: string;
  weight: number;
}

export class CategoryClassifier {
  private static readonly CATEGORY_KEYWORDS: Record<CategoryCode, {
    keywords: string[];
    weight: number;
    requiredVerification?: boolean;
  }> = {
    [CategoryCode.POLITICS]: {
      keywords: [
        'election', 'president', 'prime minister', 'government', 'parliament',
        'congress', 'senate', 'vote', 'policy', 'politics', 'democrat', 'republican',
        'party', 'campaign', 'trump', 'biden', 'ramaphosa', 'zuma', 'modi', 'putin',
        'brexit', 'tax', 'law', 'bill', 'regulation', 'minister', 'mayor', 'governor',
        'senator', 'representative', 'cabinet', 'administration', 'opposition',
        'coalition', 'manifesto', 'referendum', 'impeachment', 'scandal'
      ],
      weight: 0.8,
      requiredVerification: true
    },
    [CategoryCode.ENTERTAINMENT]: {
      keywords: [
        'movie', 'film', 'music', 'song', 'album', 'concert', 'celebrity', 'actor',
        'actress', 'singer', 'musician', 'artist', 'hollywood', 'bollywood', 'nollywood',
        'netflix', 'spotify', 'youtube', 'tiktok', 'instagram', 'award', 'oscar',
        'grammy', 'bafta', 'emmy', 'theatre', 'drama', 'comedy', 'reality tv',
        'celebrity gossip', 'breakup', 'relationship', 'dating', 'marriage', 'divorce',
        'paparazzi', 'red carpet', 'premiere', 'trailer', 'release', 'debut'
      ],
      weight: 0.7
    },
    [CategoryCode.SPORTS]: {
      keywords: [
        'football', 'soccer', 'cricket', 'rugby', 'tennis', 'basketball', 'baseball',
        'match', 'game', 'team', 'player', 'coach', 'score', 'goal', 'win', 'lose',
        'championship', 'league', 'cup', 'world cup', 'olympics', 'premier league',
        'laliga', 'bundesliga', 'serie a', 'nba', 'nfl', 'mlb', 'nhl', 'formula 1',
        'athlete', 'sport', 'tournament', 'final', 'semi-final', 'quarter-final',
        'transfer', 'contract', 'injury', 'retirement', 'record', 'medal', 'trophy'
      ],
      weight: 0.6
    },
    [CategoryCode.TECHNOLOGY]: {
      keywords: [
        'technology', 'tech', 'software', 'app', 'iphone', 'android', 'samsung',
        'apple', 'google', 'microsoft', 'amazon', 'facebook', 'meta', 'tesla',
        'spacex', 'ai', 'artificial intelligence', 'machine learning', 'crypto',
        'bitcoin', 'blockchain', 'startup', 'innovation', 'gadget', 'device',
        'computer', 'laptop', 'internet', 'website', 'code', 'programming',
        'data', 'cloud', 'cybersecurity', 'hack', 'breach', 'update', 'release',
        'launch', 'ceo', 'founder', 'investment', 'funding', 'unicorn'
      ],
      weight: 0.7
    },
    [CategoryCode.CULTURE]: {
      keywords: [
        'culture', 'tradition', 'festival', 'celebration', 'holiday', 'heritage',
        'language', 'food', 'cuisine', 'fashion', 'style', 'art', 'museum',
        'dance', 'music genre', 'cultural', 'identity', 'community', 'religion',
        'ritual', 'custom', 'norm', 'value', 'belief', 'practice', 'lifestyle',
        'trend', 'viral', 'meme', 'slang', 'dialect', 'ethnic', 'indigenous',
        'modern', 'contemporary', 'traditional', 'historical'
      ],
      weight: 0.5
    },
    [CategoryCode.FINANCE]: {
      keywords: [
        'money', 'finance', 'financial', 'economy', 'economic', 'market', 'stock',
        'share', 'trading', 'investment', 'investor', 'bank', 'banking', 'loan',
        'credit', 'debt', 'interest', 'inflation', 'recession', 'gdp', 'currency',
        'forex', 'cryptocurrency', 'bitcoin', 'ethereum', 'nft', 'portfolio',
        'dividend', 'profit', 'loss', 'revenue', 'earnings', 'tax', 'budget',
        'spending', 'saving', 'retirement', 'insurance', 'mortgage', 'property',
        'real estate', 'entrepreneur', 'startup funding', 'ipo', 'market cap'
      ],
      weight: 0.8,
      requiredVerification: true
    },
    [CategoryCode.SAFETY]: {
      keywords: [
        'crime', 'criminal', 'police', 'arrest', 'investigation', 'safety', 'security',
        'emergency', 'accident', 'incident', 'attack', 'violence', 'threat', 'danger',
        'warning', 'alert', 'scam', 'fraud', 'theft', 'robbery', 'murder', 'shooting',
        'terrorism', 'protest', 'riot', 'curfew', 'lockdown', 'evacuation', 'disaster',
        'fire', 'flood', 'earthquake', 'storm', 'pandemic', 'virus', 'outbreak',
        'missing', 'kidnapping', 'harassment', 'abuse', 'assault', 'victim'
      ],
      weight: 0.9,
      requiredVerification: true
    },
    [CategoryCode.EDUCATION]: {
      keywords: [
        'education', 'school', 'university', 'college', 'student', 'teacher',
        'professor', 'exam', 'test', 'study', 'learn', 'course', 'degree',
        'diploma', 'graduation', 'academic', 'research', 'knowledge', 'skill',
        'training', 'workshop', 'seminar', 'conference', 'library', 'book',
        'online learning', 'e-learning', 'tuition', 'fees', 'scholarship',
        'bursary', 'student loan', 'campus', 'semester', 'curriculum'
      ],
      weight: 0.6
    },
    [CategoryCode.HEALTH]: {
      keywords: [
        'health', 'medical', 'doctor', 'hospital', 'patient', 'treatment', 'medicine',
        'disease', 'illness', 'sickness', 'cure', 'therapy', 'surgery', 'diagnosis',
        'symptoms', 'vaccine', 'vaccination', 'pandemic', 'covid', 'cancer', 'diabetes',
        'heart disease', 'mental health', 'depression', 'anxiety', 'stress', 'wellness',
        'fitness', 'exercise', 'diet', 'nutrition', 'weight loss', 'healthcare',
        'pharmaceutical', 'drug', 'medication', 'clinic', 'nurse', 'healthcare worker'
      ],
      weight: 0.7
    },
    [CategoryCode.SCIENCE]: {
      keywords: [
        'science', 'scientific', 'research', 'study', 'experiment', 'discovery',
        'innovation', 'breakthrough', 'technology', 'space', 'nasa', 'spacex',
        'astronomy', 'physics', 'chemistry', 'biology', 'genetics', 'evolution',
        'climate', 'environment', 'nature', 'wildlife', 'ecosystem', 'sustainable',
        'renewable', 'energy', 'solar', 'wind', 'carbon', 'emission', 'global warming',
        'scientist', 'laboratory', 'data', 'analysis', 'theory', 'hypothesis'
      ],
      weight: 0.6
    },
    [CategoryCode.BUSINESS]: {
      keywords: [
        'business', 'company', 'corporation', 'enterprise', 'organization', 'firm',
        'industry', 'commercial', 'retail', 'wholesale', 'trade', 'commerce', 'market',
        'customer', 'client', 'service', 'product', 'brand', 'marketing', 'sales',
        'revenue', 'profit', 'loss', 'growth', 'expansion', 'merger', 'acquisition',
        'partnership', 'joint venture', 'franchise', 'chain', 'branch', 'headquarters',
        'ceo', 'director', 'manager', 'employee', 'staff', 'workforce', 'human resources'
      ],
      weight: 0.6
    },
    [CategoryCode.LIFESTYLE]: {
      keywords: [
        'lifestyle', 'living', 'life', 'home', 'house', 'apartment', 'garden',
        'decor', 'design', 'fashion', 'style', 'clothing', 'outfit', 'beauty',
        'makeup', 'skincare', 'hair', 'wellness', 'self-care', 'hobby', 'interest',
        'travel', 'vacation', 'holiday', 'trip', 'destination', 'tourism', 'adventure',
        'family', 'parenting', 'children', 'kids', 'relationship', 'dating', 'marriage',
        'wedding', 'divorce', 'friendship', 'social', 'community', 'personal', 'private'
      ],
      weight: 0.5
    },
    [CategoryCode.MISC]: {
      keywords: [
        'trending', 'viral', 'meme', 'funny', 'interesting', 'weird', 'strange',
        'amazing', 'incredible', 'unbelievable', 'shocking', 'surprising', 'curious',
        'bizarre', 'unusual', 'rare', 'unique', 'special', 'extraordinary', 'remarkable',
        'outstanding', 'exceptional', 'phenomenal', 'spectacular', 'impressive',
        'awesome', 'cool', 'epic', 'lit', 'fire', 'slay', 'vibes', 'mood'
      ],
      weight: 0.3
    },
    [CategoryCode.CRIME]: {
      keywords: [
        'murder', 'homicide', 'killing', 'death', 'violent', 'weapon', 'gun', 'knife',
        'attack', 'assault', 'rape', 'sexual assault', 'robbery', 'theft', 'burglary',
        'fraud', 'scam', 'corruption', 'bribery', 'extortion', 'blackmail',
        'kidnapping', 'abduction', 'hostage', 'terrorism', 'bomb', 'explosion',
        'shooting', 'stabbing', 'gang', 'cartel', 'mafia', 'organized crime',
        'drug trafficking', 'human trafficking', 'money laundering'
      ],
      weight: 1.0,
      requiredVerification: true
    }
  };

  private static readonly SENTIMENT_CATEGORY_MAPPING: Record<string, CategoryCode[]> = {
    'very_negative': [CategoryCode.CRIME, CategoryCode.SAFETY, CategoryCode.POLITICS],
    'negative': [CategoryCode.POLITICS, CategoryCode.FINANCE, CategoryCode.SAFETY],
    'neutral': [CategoryCode.EDUCATION, CategoryCode.SCIENCE, CategoryCode.TECHNOLOGY],
    'positive': [CategoryCode.ENTERTAINMENT, CategoryCode.SPORTS, CategoryCode.LIFESTYLE],
    'very_positive': [CategoryCode.ENTERTAINMENT, CategoryCode.CULTURE, CategoryCode.MISC]
  };

  /**
   * Detect category from content
   */
  static detectCategory(content: {
    text: string;
    sentiment?: number;
    platforms?: string[];
    entities?: Array<{ type: string; value: string }>;
    engagement?: {
      likes: number;
      shares: number;
      comments: number;
    };
  }): CategoryDetection {
    const indicators: CategoryIndicator[] = [];
    const text = content.text.toLowerCase();

    // Keyword detection
    Object.entries(this.CATEGORY_KEYWORDS).forEach(([category, config]) => {
      const matchedKeywords = config.keywords.filter(keyword =>
        text.includes(keyword.toLowerCase())
      );

      matchedKeywords.forEach(keyword => {
        indicators.push({
          type: 'keyword',
          value: keyword,
          weight: config.weight / config.keywords.length
        });
      });
    });

    // Sentiment-based category influence
    if (content.sentiment !== undefined) {
      const sentimentCategory = this.getSentimentCategory(content.sentiment);
      const possibleCategories = this.SENTIMENT_CATEGORY_MAPPING[sentimentCategory];

      possibleCategories.forEach(category => {
        indicators.push({
          type: 'sentiment',
          value: sentimentCategory,
          weight: 0.1
        });
      });
    }

    // Entity-based classification
    if (content.entities) {
      content.entities.forEach(entity => {
        const entityCategory = this.classifyEntity(entity.type, entity.value);
        if (entityCategory) {
          indicators.push({
            type: 'entity',
            value: entity.value,
            weight: 0.4
          });
        }
      });
    }

    // Platform influence
    if (content.platforms) {
      content.platforms.forEach(platform => {
        const platformCategory = this.classifyPlatform(platform);
        if (platformCategory) {
          indicators.push({
            type: 'platform',
            value: platform,
            weight: 0.2
          });
        }
      });
    }

    // Engagement-based influence
    if (content.engagement) {
      const engagementCategory = this.classifyEngagement(content.engagement);
      if (engagementCategory) {
        indicators.push({
          type: 'engagement',
          value: 'high_engagement',
          weight: 0.1
        });
      }
    }

    return this.aggregateCategoryIndicators(indicators);
  }

  /**
   * Get sentiment category from sentiment score
   */
  private static getSentimentCategory(sentiment: number): string {
    if (sentiment <= -0.7) return 'very_negative';
    if (sentiment <= -0.2) return 'negative';
    if (sentiment <= 0.2) return 'neutral';
    if (sentiment <= 0.7) return 'positive';
    return 'very_positive';
  }

  /**
   * Classify entity to category
   */
  private static classifyEntity(entityType: string, entityValue: string): CategoryCode | null {
    const entityValueLower = entityValue.toLowerCase();

    switch (entityType) {
      case 'PERSON':
        if (this.CATEGORY_KEYWORDS[CategoryCode.POLITICS].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.POLITICS;
        if (this.CATEGORY_KEYWORDS[CategoryCode.ENTERTAINMENT].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.ENTERTAINMENT;
        if (this.CATEGORY_KEYWORDS[CategoryCode.SPORTS].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.SPORTS;
        break;

      case 'ORGANIZATION':
        if (this.CATEGORY_KEYWORDS[CategoryCode.TECHNOLOGY].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.TECHNOLOGY;
        if (this.CATEGORY_KEYWORDS[CategoryCode.FINANCE].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.FINANCE;
        if (this.CATEGORY_KEYWORDS[CategoryCode.BUSINESS].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.BUSINESS;
        break;

      case 'LOCATION':
        // Location doesn't directly map to category, but can influence
        return null;

      case 'EVENT':
        if (this.CATEGORY_KEYWORDS[CategoryCode.SPORTS].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.SPORTS;
        if (this.CATEGORY_KEYWORDS[CategoryCode.ENTERTAINMENT].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.ENTERTAINMENT;
        if (this.CATEGORY_KEYWORDS[CategoryCode.POLITICS].keywords.some(k =>
          entityValueLower.includes(k))) return CategoryCode.POLITICS;
        break;
    }

    return null;
  }

  /**
   * Classify platform to category
   */
  private static classifyPlatform(platform: string): CategoryCode | null {
    const platformLower = platform.toLowerCase();

    if (platformLower.includes('tiktok') || platformLower.includes('instagram')) {
      return CategoryCode.ENTERTAINMENT;
    }

    if (platformLower.includes('linkedin')) {
      return CategoryCode.BUSINESS;
    }

    if (platformLower.includes('twitter') || platformLower.includes('reddit')) {
      return CategoryCode.POLITICS;
    }

    if (platformLower.includes('youtube')) {
      return CategoryCode.ENTERTAINMENT;
    }

    return null;
  }

  /**
   * Classify engagement pattern to category
   */
  private static classifyEngagement(engagement: {
    likes: number;
    shares: number;
    comments: number;
  }): CategoryCode | null {
    const { likes, shares, comments } = engagement;
    const totalEngagement = likes + shares + comments;

    // High engagement with lots of shares suggests viral/entertainment content
    if (totalEngagement > 10000 && shares > likes * 0.5) {
      return CategoryCode.ENTERTAINMENT;
    }

    // High comments with lower shares suggests controversial/political content
    if (comments > likes * 0.3) {
      return CategoryCode.POLITICS;
    }

    return null;
  }

  /**
   * Aggregate indicators to determine most likely category
   */
  private static aggregateCategoryIndicators(indicators: CategoryIndicator[]): CategoryDetection {
    const categoryScores = new Map<CategoryCode, number>();

    indicators.forEach(indicator => {
      // Find which categories this indicator contributes to
      const contributingCategories = this.getContributingCategories(indicator);

      contributingCategories.forEach(category => {
        const currentScore = categoryScores.get(category) || 0;
        categoryScores.set(category, currentScore + indicator.weight);
      });
    });

    if (categoryScores.size === 0) {
      return {
        category: CategoryCode.MISC,
        confidence: 0.1,
        indicators: [],
        riskLevel: 'LOW'
      };
    }

    // Find category with highest score
    let maxScore = 0;
    let detectedCategory = CategoryCode.MISC;

    categoryScores.forEach((score, category) => {
      if (score > maxScore) {
        maxScore = score;
        detectedCategory = category;
      }
    });

    // Calculate confidence
    const totalScore = Array.from(categoryScores.values()).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.1;

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(detectedCategory, confidence);

    return {
      category: detectedCategory,
      confidence: Math.min(confidence, 1.0),
      indicators,
      riskLevel
    };
  }

  /**
   * Get categories that an indicator contributes to
   */
  private static getContributingCategories(indicator: CategoryIndicator): CategoryCode[] {
    const value = indicator.value.toLowerCase();
    const contributing: CategoryCode[] = [];

    Object.entries(this.CATEGORY_KEYWORDS).forEach(([category, config]) => {
      if (config.keywords.some(keyword => value.includes(keyword.toLowerCase()))) {
        contributing.push(category as CategoryCode);
      }
    });

    return contributing;
  }

  /**
   * Calculate risk level for category
   */
  private static calculateRiskLevel(category: CategoryCode, confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const categoryConfig = this.CATEGORY_KEYWORDS[category];

    if (categoryConfig.requiredVerification) {
      return 'HIGH';
    }

    if (confidence < 0.3) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Check if category requires verification
   */
  static requiresVerification(category: CategoryCode): boolean {
    return this.CATEGORY_KEYWORDS[category]?.requiredVerification || false;
  }

  /**
   * Get category-specific content guidelines
   */
  static getCategoryGuidelines(category: CategoryCode): {
    allowedContent: string[];
    restrictedContent: string[];
    verificationRequired: boolean;
  } {
    const guidelines = {
      [CategoryCode.POLITICS]: {
        allowedContent: ['Policy discussions', 'Election coverage', 'Government announcements'],
        restrictedContent: ['Hate speech', 'Violence incitement', 'Misinformation'],
        verificationRequired: true
      },
      [CategoryCode.FINANCE]: {
        allowedContent: ['Market analysis', 'Company news', 'Economic trends'],
        restrictedContent: ['Financial advice', 'Pump and dump schemes', 'Insider trading'],
        verificationRequired: true
      },
      [CategoryCode.SAFETY]: {
        allowedContent: ['Official safety alerts', 'Verified incident reports'],
        restrictedContent: ['Graphic content', 'Unverified rumors', 'Victim blaming'],
        verificationRequired: true
      },
      [CategoryCode.CRIME]: {
        allowedContent: ['Official police reports', 'Court documents'],
        restrictedContent: ['Accusations without evidence', 'Victim details', 'Graphic descriptions'],
        verificationRequired: true
      }
    };

    return guidelines[category] || {
      allowedContent: ['General content'],
      restrictedContent: ['Illegal content', 'Harmful material'],
      verificationRequired: false
    };
  }
}
