export interface SocialContent {
  id: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin';
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    verified: boolean;
    followersCount: number;
  };
  metrics: {
    likes: number;
    shares: number;
    comments: number;
    views?: number;
    engagement: number;
  };
  media: SocialMediaAsset[];
  hashtags: string[];
  mentions: string[];
  urls: string[];
  createdAt: Date;
  updatedAt: Date;
  location?: {
    name: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  language: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  topics: string[];
  isViral: boolean;
  viralScore: number;
}

export interface SocialMediaAsset {
  id: string;
  type: 'image' | 'video' | 'gif' | 'audio';
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  size: number;
  format: string;
}

export interface SocialContentFilter {
  platforms?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  authors?: string[];
  hashtags?: string[];
  topics?: string[];
  minEngagement?: number;
  minViralScore?: number;
  language?: string;
  sentiment?: string;
  isViral?: boolean;
}

export interface SocialContentAnalytics {
  totalPosts: number;
  engagementRate: number;
  topPlatforms: {
    platform: string;
    count: number;
    percentage: number;
  }[];
  topHashtags: {
    hashtag: string;
    count: number;
  }[];
  topAuthors: {
    author: string;
    count: number;
    followersCount: number;
  }[];
  viralContent: SocialContent[];
  sentimentAnalysis: {
    positive: number;
    negative: number;
    neutral: number;
  };
  engagementTrends: {
    date: string;
    engagement: number;
  }[];
}

export interface SocialContentMetrics {
  reach: number;
  impressions: number;
  engagement: number;
  clicks: number;
  shares: number;
  saves: number;
  conversions?: number;
  roi?: number;
}