export interface CollectionResult {
  platform: string;
  collected: number;
  processed: number;
  failed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface CollectionStatus {
  platform: string;
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  totalCollected: number;
  totalFailed: number;
}

export interface IngestJobData {
  platform: string;
  content: Content;
  retryCount: number;
  timestamp: Date;
}

export interface Content {
  platform: string;
  nativeId: string;
  authorId: string;
  authorHandle?: string;
  contentId?: string;
  textContent: string;
  mediaUrls: MediaUrl[];
  metrics: ContentMetrics;
  hashtags?: string[];
  mentions?: string[];
  location?: {
    name?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  language?: string;
  timestamp: Date;
  source?: string;
  engagement: {
    score: number;
    tier: 'low' | 'medium' | 'high' | 'viral';
  };
  metadata?: Record<string, any>;
}

export interface ContentMetrics {
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  plays?: number;
  saves?: number;
  clicks?: number;
  reactions?: {
    like?: number;
    love?: number;
    laugh?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  engagement?: number;
  reach?: number;
  impressions?: number;
}

export interface MediaUrl {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link' | 'gif';
  thumbnail?: string;
  duration?: number;
  size?: number;
  metadata?: Record<string, any>;
}

export interface PlatformConfig {
  enabled: boolean;
  rateLimit: number;
  keywords: string[];
  hashtags: string[];
  regions: string[];
  languages: string[];
  [key: string]: any;
}

export interface IngestStats {
  totalProcessed: number;
  totalFailed: number;
  avgProcessingTime: number;
  lastProcessedAt?: Date;
  platformStats: {
    [platform: string]: {
      processed: number;
      failed: number;
      avgTime: number;
    };
  };
}