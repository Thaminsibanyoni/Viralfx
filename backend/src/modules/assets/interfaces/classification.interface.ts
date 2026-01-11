export interface ClassificationResult {
  contentId: string;
  primaryCategory: string;
  secondaryCategories: string[];
  confidence: number;
  classificationMethod: 'ml' | 'rule-based' | 'hybrid';
  features: ContentFeatures;
  assetMetrics: AssetMetrics;
  createdAt: Date;
}

export interface ContentFeatures {
  textFeatures: TextFeatures;
  visualFeatures: VisualFeatures;
  audioFeatures: AudioFeatures;
  engagementFeatures: EngagementFeatures;
}

export interface TextFeatures {
  sentiment: number;
  keywords: string[];
  entities: string[];
  topics: string[];
  readabilityScore: number;
  language: string;
}

export interface VisualFeatures {
  dominantColors: string[];
  objects: string[];
  scenes: string[];
  faces: boolean;
  textPresence: boolean;
  imageQuality: number;
}

export interface AudioFeatures {
  duration: number;
  bitrate: number;
  frequency: number;
  hasSpeech: boolean;
  hasMusic: boolean;
  volume: number;
}

export interface EngagementFeatures {
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  engagementRate: number;
}

export interface AssetMetrics {
  fileSize: number;
  duration?: number;
  resolution?: string;
  format: string;
  quality: number;
  compressionRatio: number;
}

export interface ClassificationConfig {
  confidenceThreshold: number;
  enableMlClassification: boolean;
  enableRuleBasedClassification: boolean;
  customRules: ClassificationRule[];
}

export interface ClassificationRule {
  name: string;
  conditions: RuleCondition[];
  category: string;
  priority: number;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
  weight?: number;
}