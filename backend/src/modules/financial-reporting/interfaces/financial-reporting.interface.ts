export interface CohortAnalysisResult {
  cohortId: string;
  cohortSize: number;
  period: string;
  retentionRates: number[];
  averageLTV: number;
  revenueMetrics: {
    totalRevenue: number;
    averageRevenuePerUser: number;
    cumulativeRevenue: number;
  };
}

export interface RetentionCurves {
  cohorts: CohortData[];
  timePeriods: string[];
  retentionMatrix: number[][];
  averageRetention: number[];
}

export interface CohortData {
  cohortId: string;
  cohortPeriod: string;
  cohortSize: number;
  retentionRates: number[];
  cumulativeRevenue: number[];
}

export interface RevenueByChannel {
  channels: ChannelData[];
  totalRevenue: number;
  period: DatePeriod;
}

export interface ChannelData {
  channel: string;
  revenue: number;
  userCount: number;
  averageRevenuePerUser: number;
  percentageOfTotal: number;
}

export interface LTVByCohort {
  cohorts: Array<{
    cohortId: string;
    cohortPeriod: string;
    cohortSize: number;
    ltv: number;
    ltvTrend: LTVTrend;
    revenue: number;
    retentionRate: number;
  }>;
  overallTrend: LTVTrend;
  averageLTV: number;
}

export enum LTVTrend {
  IMPROVING = "improving",
  DECLINING = "declining",
  STABLE = "stable"
}

export interface RevenueByRegion {
  regions: RegionData[];
  totalRevenue: number;
  period: DatePeriod;
}

export interface RegionData {
  region: string;
  revenue: number;
  userCount: number;
  averageRevenuePerUser: number;
  growthRate: number;
  percentageOfTotal: number;
}

export interface RevenueByTier {
  tiers: TierData[];
  totalRevenue: number;
  period: DatePeriod;
}

export interface TierData {
  tier: string;
  revenue: number;
  userCount: number;
  averageRevenuePerUser: number;
  upgradeRate: number;
  downgradeRate: number;
}

export interface RevenueByProduct {
  products: ProductData[];
  totalRevenue: number;
  period: DatePeriod;
}

export interface ProductData {
  product: string;
  category: string;
  revenue: number;
  userCount: number;
  averageRevenuePerUser: number;
  growthRate: number;
  usageCount: number;
}

export interface RevenueGrowth {
  currentPeriod: {
    start: Date;
    end: Date;
    revenue: number;
  };
  previousPeriod: {
    start: Date;
    end: Date;
    revenue: number;
  };
  growthRate: number;
  trend: RevenueTrend[];
  cagr: number;
}

export interface RevenueTrend {
  period: string;
  revenue: number;
  growthRate: number;
}

export interface ARPUAnalysis {
  currentARPU: number;
  previousARPU: number;
  growthRate: number;
  trend: ARPUTrend[];
  byUserType: {
    individual: number;
    business: number;
    enterprise: number;
  };
  byRegion: Record<string, number>;
}

export interface ARPUTrend {
  period: string;
  arpu: number;
  userCount: number;
  totalRevenue: number;
}

export interface RevenueReport {
  period: DatePeriod;
  totalRevenue: number;
  revenueByRegion: RevenueByRegion;
  revenueByTier: RevenueByTier;
  revenueByProduct: RevenueByProduct;
  arpuAnalysis: ARPUAnalysis;
  growth: RevenueGrowth;
  keyMetrics: {
    activeUsers: number;
    payingUsers: number;
    conversionRate: number;
    churnRate: number;
    customerLifetimeValue: number;
  };
}

export interface DatePeriod {
  start: Date;
  end: Date;
}

export enum ReportFormat {
  JSON = "json",
  CSV = "csv",
  PDF = "pdf"
}

export enum TimeGrouping {
  HOUR = "hour",
  DAY = "day",
  MONTH = "month"
}