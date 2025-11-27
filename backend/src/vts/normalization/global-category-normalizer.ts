/**
 * Global Category Normalization Layer
 * Cross-cultural normalization of entities, concepts, and categories
 * © 2025 ViralFX - Global Intelligence System
 */

import { CategoryCode, RegionCode } from '../../types/vts';

export interface NormalizationResult {
  normalizedCategory: CategoryCode;
  confidence: number;
  region: RegionCode;
  originalText: string;
  normalizedText: string;
  context: NormalizationContext;
  alternatives?: AlternativeNormalization[];
}

export interface NormalizationContext {
  language: string;
  culturalContext: string;
  platform: string;
  temporalContext?: string;
  geographicContext?: string;
}

export interface AlternativeNormalization {
  category: CategoryCode;
  confidence: number;
  reasoning: string;
}

export interface EntityMapping {
  entity: string;
  normalizedForm: string;
  category: CategoryCode;
  regionalVariations: RegionalVariation[];
  synonyms: string[];
  relatedConcepts: string[];
}

export interface RegionalVariation {
  region: RegionCode;
  localTerm: string;
  culturalContext: string;
  usage: 'COMMON' | 'FORMAL' | 'INFORMAL' | 'SLANG';
}

export interface CulturalConcept {
  concept: string;
  globalCategory: CategoryCode;
  regionalMappings: RegionalConceptMapping[];
  culturalNotes: string[];
  sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RegionalConceptMapping {
  region: RegionCode;
  localTerm: string;
  context: string;
  examples: string[];
  restrictions?: string[];
}

export class GlobalCategoryNormalizer {
  private entityMappings: Map<string, EntityMapping> = new Map();
  private culturalConcepts: Map<string, CulturalConcept> = new Map();
  private synonymDatabase: Map<string, string[]> = new Map();
  private crossRegionalMapper: CrossRegionalMapper;

  constructor() {
    this.crossRegionalMapper = new CrossRegionalMapper();
    this.initializeEntityMappings();
    this.initializeCulturalConcepts();
    this.initializeSynonymDatabase();
  }

  /**
   * Normalize content across cultures and regions
   */
  async normalize(
    text: string,
    region: RegionCode,
    context: NormalizationContext
  ): Promise<NormalizationResult> {
    // Extract entities and concepts
    const entities = await this.extractEntities(text, context);
    const concepts = await this.extractConcepts(text, context);

    // Normalize each entity
    const normalizedEntities = await Promise.all(
      entities.map(entity => this.normalizeEntity(entity, region, context))
    );

    // Determine primary category
    const primaryCategory = this.determinePrimaryCategory(normalizedEntities, concepts);
    const confidence = this.calculateNormalizationConfidence(normalizedEntities, concepts);

    // Generate alternatives if confidence is low
    const alternatives = confidence < 0.8 ?
      await this.generateAlternatives(text, region, context, primaryCategory) : [];

    return {
      normalizedCategory: primaryCategory,
      confidence,
      region,
      originalText: text,
      normalizedText: this.generateNormalizedText(normalizedEntities),
      context,
      alternatives
    };
  }

  /**
   * Normalize a specific entity
   */
  async normalizeEntity(
    entity: string,
    region: RegionCode,
    context: NormalizationContext
  ): Promise<EntityMapping> {
    const entityKey = entity.toLowerCase().trim();

    // Check direct mapping
    if (this.entityMappings.has(entityKey)) {
      const mapping = this.entityMappings.get(entityKey)!;

      // Check for regional variation
      const regionalVariation = mapping.regionalVariations.find(
        rv => rv.region === region
      );

      if (regionalVariation) {
        return {
          ...mapping,
          normalizedForm: regionalVariation.localTerm
        };
      }

      return mapping;
    }

    // Check synonym database
    const synonyms = this.synonymDatabase.get(entityKey);
    if (synonyms) {
      for (const synonym of synonyms) {
        if (this.entityMappings.has(synonym)) {
          return this.entityMappings.get(synonym)!;
        }
      }
    }

    // Use cross-regional mapping
    return await this.crossRegionalMapper.mapEntity(entity, region, context);
  }

  /**
   * Extract entities from text
   */
  private async extractEntities(text: string, context: NormalizationContext): Promise<string[]> {
    const entities: string[] = [];

    // Extract common patterns
    const patterns = [
      // Celebrity names
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      // Organizations
      /\b[A-Z]{2,}\b/g,
      // Titles and positions
      /\b(President|Minister|CEO|Director|Dr|Mr|Mrs|Ms)\s+[A-Z][a-z]+\b/g,
      // Brands and products
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|Corp|LLC|Ltd)\b/g,
      // Cultural terms
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:festival|holiday|celebration)\b/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }

    // Remove duplicates and filter
    return [...new Set(entities)].filter(entity => entity.length > 2);
  }

  /**
   * Extract concepts from text
   */
  private async extractConcepts(text: string, context: NormalizationContext): Promise<string[]> {
    const concepts: string[] = [];

    // Look for concept indicators
    const conceptIndicators = [
      'election', 'government', 'policy', 'parliament', 'congress',
      'music', 'concert', 'album', 'song', 'artist', 'celebrity',
      'sports', 'match', 'game', 'team', 'player', 'championship',
      'technology', 'startup', 'innovation', 'AI', 'digital',
      'culture', 'tradition', 'festival', 'heritage', 'celebration',
      'finance', 'market', 'economy', 'investment', 'trading',
      'safety', 'emergency', 'crisis', 'disaster', 'warning'
    ];

    const textLower = text.toLowerCase();
    for (const indicator of conceptIndicators) {
      if (textLower.includes(indicator)) {
        concepts.push(indicator);
      }
    }

    return concepts;
  }

  /**
   * Determine primary category from normalized entities and concepts
   */
  private determinePrimaryCategory(
    entities: EntityMapping[],
    concepts: string[]
  ): CategoryCode {
    const categoryScores = new Map<CategoryCode, number>();

    // Score entities
    entities.forEach(entity => {
      const currentScore = categoryScores.get(entity.category) || 0;
      categoryScores.set(entity.category, currentScore + 1);
    });

    // Score concepts
    concepts.forEach(concept => {
      const category = this.conceptToCategory(concept);
      if (category) {
        const currentScore = categoryScores.get(category) || 0;
        categoryScores.set(category, currentScore + 0.5);
      }
    });

    // Find category with highest score
    let maxScore = 0;
    let primaryCategory = CategoryCode.MISC;

    categoryScores.forEach((score, category) => {
      if (score > maxScore) {
        maxScore = score;
        primaryCategory = category;
      }
    });

    return primaryCategory;
  }

  /**
   * Map concept to category
   */
  private conceptToCategory(concept: string): CategoryCode | null {
    const conceptMappings: Record<string, CategoryCode> = {
      'election': CategoryCode.POLITICS,
      'government': CategoryCode.POLITICS,
      'policy': CategoryCode.POLITICS,
      'parliament': CategoryCode.POLITICS,
      'congress': CategoryCode.POLITICS,
      'music': CategoryCode.ENTERTAINMENT,
      'concert': CategoryCode.ENTERTAINMENT,
      'album': CategoryCode.ENTERTAINMENT,
      'song': CategoryCode.ENTERTAINMENT,
      'artist': CategoryCode.ENTERTAINMENT,
      'celebrity': CategoryCode.ENTERTAINMENT,
      'sports': CategoryCode.SPORTS,
      'match': CategoryCode.SPORTS,
      'game': CategoryCode.SPORTS,
      'team': CategoryCode.SPORTS,
      'player': CategoryCode.SPORTS,
      'championship': CategoryCode.SPORTS,
      'technology': CategoryCode.TECHNOLOGY,
      'startup': CategoryCode.TECHNOLOGY,
      'innovation': CategoryCode.TECHNOLOGY,
      'ai': CategoryCode.TECHNOLOGY,
      'digital': CategoryCode.TECHNOLOGY,
      'culture': CategoryCode.CULTURE,
      'tradition': CategoryCode.CULTURE,
      'festival': CategoryCode.CULTURE,
      'heritage': CategoryCode.CULTURE,
      'celebration': CategoryCode.CULTURE,
      'finance': CategoryCode.FINANCE,
      'market': CategoryCode.FINANCE,
      'economy': CategoryCode.FINANCE,
      'investment': CategoryCode.FINANCE,
      'trading': CategoryCode.FINANCE,
      'safety': CategoryCode.SAFETY,
      'emergency': CategoryCode.SAFETY,
      'crisis': CategoryCode.SAFETY,
      'disaster': CategoryCode.SAFETY,
      'warning': CategoryCode.SAFETY
    };

    return conceptMappings[concept] || null;
  }

  /**
   * Calculate normalization confidence
   */
  private calculateNormalizationConfidence(
    entities: EntityMapping[],
    concepts: string[]
  ): number {
    const entityConfidence = entities.length > 0 ? 0.8 : 0.4;
    const conceptConfidence = concepts.length > 0 ? 0.6 : 0.3;

    return Math.max(entityConfidence, conceptConfidence);
  }

  /**
   * Generate normalized text
   */
  private generateNormalizedText(entities: EntityMapping[]): string {
    return entities.map(entity => entity.normalizedForm).join(' ');
  }

  /**
   * Generate alternative normalizations
   */
  private async generateAlternatives(
    text: string,
    region: RegionCode,
    context: NormalizationContext,
    primaryCategory: CategoryCode
  ): Promise<AlternativeNormalization[]> {
    const alternatives: AlternativeNormalization[] = [];

    // Try different regional contexts
    const alternativeRegions = [RegionCode.USA, RegionCode.UK, RegionCode.GLOBAL];

    for (const altRegion of alternativeRegions) {
      if (altRegion !== region) {
        const altContext = { ...context, language: 'en' };
        const altResult = await this.normalize(text, altRegion, altContext);

        if (altResult.normalizedCategory !== primaryCategory) {
          alternatives.push({
            category: altResult.normalizedCategory,
            confidence: altResult.confidence * 0.7, // Reduce confidence for alternatives
            reasoning: `Regional variation in ${altRegion}`
          });
        }
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  private initializeEntityMappings(): void {
    // Celebrity mappings
    this.addEntityMapping('DJ Zinhle', 'DJ Zinhle', CategoryCode.ENTERTAINMENT, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'DJ Zinhle', culturalContext: 'SA Music Industry', usage: 'COMMON' }
    ], ['Zinhle', 'DJ'], ['music producer', 'entertainer']);

    this.addEntityMapping('Davido', 'Davido', CategoryCode.ENTERTAINMENT, [
      { region: RegionCode.NIGERIA, localTerm: 'Davido', culturalContext: 'Nigerian Music', usage: 'COMMON' },
      { region: RegionCode.GLOBAL, localTerm: 'Davido', culturalContext: 'Afrobeats', usage: 'COMMON' }
    ], ['OBO', 'Davido Adeleke'], ['musician', 'singer', 'afrobeats']);

    this.addEntityMapping('Donald Trump', 'Donald Trump', CategoryCode.POLITICS, [
      { region: RegionCode.USA, localTerm: 'Donald Trump', culturalContext: 'US Politics', usage: 'COMMON' },
      { region: RegionCode.GLOBAL, localTerm: 'Donald Trump', culturalContext: 'Global Politics', usage: 'COMMON' }
    ], ['Trump', 'President Trump'], ['politician', 'president', 'businessman']);

    // Government positions
    this.addEntityMapping('President', 'Head of State', CategoryCode.POLITICS, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'President', culturalContext: 'SA Government', usage: 'FORMAL' },
      { region: RegionCode.USA, localTerm: 'President', culturalContext: 'US Government', usage: 'FORMAL' },
      { region: RegionCode.NIGERIA, localTerm: 'President', culturalContext: 'Nigerian Government', usage: 'FORMAL' }
    ], ['Head of State', 'Leader'], ['government', 'politics', 'leadership']);

    this.addEntityMapping('Minister', 'Government Minister', CategoryCode.POLITICS, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'Minister', culturalContext: 'SA Government', usage: 'FORMAL' },
      { region: RegionCode.UK, localTerm: 'Minister', culturalContext: 'UK Government', usage: 'FORMAL' }
    ], ['Cabinet Minister', 'Government Official'], ['government', 'politics', 'cabinet']);

    // Technology companies
    this.addEntityMapping('Apple', 'Apple Inc', CategoryCode.TECHNOLOGY, [
      { region: RegionCode.GLOBAL, localTerm: 'Apple', culturalContext: 'Technology', usage: 'COMMON' }
    ], ['Apple Inc', 'iPhone', 'iPad'], ['technology', 'computers', 'smartphones']);

    this.addEntityMapping('Google', 'Alphabet Inc', CategoryCode.TECHNOLOGY, [
      { region: RegionCode.GLOBAL, localTerm: 'Google', culturalContext: 'Technology', usage: 'COMMON' }
    ], ['Alphabet', 'Search', 'Android'], ['technology', 'internet', 'search']);

    // Cultural concepts
    this.addEntityMapping('Loadshedding', 'Load Shedding', CategoryCode.CULTURE, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'Loadshedding', culturalContext: 'SA Infrastructure', usage: 'COMMON' }
    ], ['Power cuts', 'Electricity cuts', 'Blackouts'], ['infrastructure', 'electricity', 'utilities']);

    // Sports teams
    this.addEntityMapping('Bafana Bafana', 'South Africa National Football Team', CategoryCode.SPORTS, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'Bafana Bafana', culturalContext: 'SA Sports', usage: 'COMMON' }
    ], ['SA Football Team', 'South Africa Soccer'], ['sports', 'football', 'soccer']);
  }

  private initializeCulturalConcepts(): void {
    this.addCulturalConcept('Celebrity Gossip', CategoryCode.ENTERTAINMENT, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'Z celeb gossip', context: 'Entertainment News', examples: ['DJ Zinhle breakup', 'Katlego Danke wedding'] },
      { region: RegionCode.USA, localTerm: 'Celebrity news', context: 'Entertainment', examples: ['Kardashian drama', 'Celebrity relationships'] },
      { region: RegionCode.NIGERIA, localTerm: 'Celeb gist', context: 'Entertainment', examples: ['Davido relationships', 'Nollywood news'] }
    ], ['Entertainment industry', 'Celebrity culture', 'Social media trends'], 'MEDIUM');

    this.addCulturalConcept('Political Scandal', CategoryCode.POLITICS, [
      { region: RegionCode.SOUTH_AFRICA, localTerm: 'Political controversy', context: 'Politics', examples: ['State capture', 'Cabinet reshuffle'], restrictions: ['Must be verified'] },
      { region: RegionCode.USA, localTerm: 'Political scandal', context: 'Politics', examples: ['Congressional investigations', 'White House controversies'] },
      { region: RegionCode.NIGERIA, localTerm: 'Political drama', context: 'Politics', examples: ['Election petitions', 'Senate controversies'] }
    ], ['Government', 'Politics', 'Corruption'], 'HIGH');
  }

  private initializeSynonymDatabase(): void {
    // Entertainment synonyms
    this.synonymDatabase.set('musician', ['artist', 'singer', 'performer', 'music artist']);
    this.synonymDatabase.set('celebrity', ['star', 'famous person', 'public figure', 'personality']);
    this.synonymDatabase.set('movie', ['film', 'cinema', 'motion picture']);

    // Politics synonyms
    this.synonymDatabase.set('politician', ['political figure', 'lawmaker', 'representative', 'official']);
    this.synonymDatabase.set('government', ['administration', 'authority', 'state', 'regime']);
    this.synonymDatabase.set('election', ['vote', 'poll', 'ballot', 'campaign']);

    // Technology synonyms
    this.synonymDatabase.set('startup', ['tech startup', 'new company', 'venture', 'innovation']);
    this.synonymDatabase.set('AI', ['artificial intelligence', 'machine learning', 'automation', 'bots']);

    // Cultural synonyms
    this.synonymDatabase.set('festival', ['celebration', 'event', 'gathering', 'festivity']);
    this.synonymDatabase.set('tradition', ['custom', 'heritage', 'culture', 'practice']);
  }

  private addEntityMapping(
    entity: string,
    normalizedForm: string,
    category: CategoryCode,
    regionalVariations: RegionalVariation[],
    synonyms: string[],
    relatedConcepts: string[]
  ): void {
    const mapping: EntityMapping = {
      entity: entity.toLowerCase(),
      normalizedForm,
      category,
      regionalVariations,
      synonyms,
      relatedConcepts
    };

    this.entityMappings.set(mapping.entity, mapping);

    // Add synonyms to database
    this.synonymDatabase.set(mapping.entity, synonyms);
  }

  private addCulturalConcept(
    concept: string,
    globalCategory: CategoryCode,
    regionalMappings: RegionalConceptMapping[],
    culturalNotes: string[],
    sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  ): void {
    const culturalConcept: CulturalConcept = {
      concept,
      globalCategory,
      regionalMappings,
      culturalNotes,
      sensitivityLevel
    };

    this.culturalConcepts.set(concept.toLowerCase(), culturalConcept);
  }
}

class CrossRegionalMapper {
  async mapEntity(
    entity: string,
    region: RegionCode,
    context: NormalizationContext
  ): Promise<EntityMapping> {
    // Fallback mapping for unknown entities
    return {
      entity: entity.toLowerCase(),
      normalizedForm: entity,
      category: CategoryCode.MISC,
      regionalVariations: [
        {
          region,
          localTerm: entity,
          culturalContext: 'Unknown',
          usage: 'COMMON'
        }
      ],
      synonyms: [],
      relatedConcepts: []
    };
  }
}