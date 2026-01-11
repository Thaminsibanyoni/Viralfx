export interface CreateMarketData {
  title: string;
  description: string;
  categoryId: string;
  outcomes: string[];
  endDate: Date;
  initialLiquidity?: number;
  metadata?: Record<string, unknown>;
}

export interface MarketOutcome {
  id: string;
  title: string;
  probability: number;
  price: number;
}

export interface MarketFilters {
  categoryId?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface MarketWithDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  categoryId: string;
  endDate: Date;
  liquidity: number;
  volume: number;
  outcomes: MarketOutcome[];
  topic?: {
  id: string;
  title: string;
  category: string;
  bets?: Array<{
  id: string;
  userId: string;
  outcomeId: string;
  amount: number;
  timestamp: Date;
  }>;
  };
}

export interface MarketPerformance {
  totalVolume: number;
  totalBets: number;
  uniqueUsers: number;
  averageBetSize: number;
  priceHistory: PriceHistoryEntry[];
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export interface MarketOdds {
  outcomeId: string;
  probability: number;
  odds: number;
  price: number;
}

export interface InitialProbabilities {
  [outcomeId: string]: number;
}

export interface PriceHistoryEntry {
  timestamp: Date;
  price: number;
  volume: number;
  outcomeId: string;
}

export enum MarketStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
  SETTLED = "SETTLED",
}

export enum MarketType {
  BINARY = "BINARY",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  RANGE = "RANGE",
  VOLUME = "VOLUME",
}

export interface SentimentData {
  score: number;
  trend: "increasing" | "decreasing" | "stable";
  confidence: number;
  lastUpdated: Date;
}

export interface ViralData {
  index: number;
  trending: boolean;
  acceleration: number;
  reach: number;
  lastUpdated: Date;
}