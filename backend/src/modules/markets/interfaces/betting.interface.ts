export interface PlaceBetData {
  marketId: string;
  outcomeId: string;
  amount: number;
  userId: string;
}

export interface BetResult {
  id: string;
  marketId: string;
  outcomeId: string;
  userId: string;
  amount: number;
  potentialWin: number;
  odds: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BetFilters {
  userId?: string;
  marketId?: string;
  status?: string;
  outcomeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface BetStatistics {
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  winRate: number;
  averageBetSize: number;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: number;
  favoriteCategories: FavoriteCategory[];
  profit: number;
  roi: number;
}

export interface MarketBetSummary {
  marketId: string;
  totalBets: number;
  totalVolume: number;
  betsByOutcome: BetsByOutcome[];
}

export interface BetsByOutcome {
  outcomeId: string;
  outcomeTitle: string;
  totalBets: number;
  totalAmount: number;
  averageBet: number;
  percentage: number;
}

export interface FavoriteCategory {
  categoryId: string;
  categoryName: string;
  betCount: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
}

export interface BetQueryFilters {
  userId?: string;
  marketId?: string;
  status?: string;
  outcomeId?: string;
  createdAt?: {
  gte?: Date;
  lte?: Date;
  };
}

export enum BetStatus {
  PENDING = "PENDING",
  WON = "WON",
  LOST = "LOST",
  CANCELLED = "CANCELLED",
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
}