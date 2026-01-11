/**
 * Bet Status Enum
 * Defines the different states of a bet
 * Note: This is also available from Prisma as @prisma/client BetStatus
 */
export enum BetStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

/**
 * Bet Type Enum
 * Defines the different types of bets
 */
export enum BetType {
  BINARY = 'BINARY',
  RANGE = 'RANGE',
  MULTI_OUTCOME = 'MULTI_OUTCOME',
  SPREAD = 'SPREAD',
  PARLAY = 'PARLAY'
}

/**
 * Bet Result Enum
 * Defines the possible outcomes of a bet
 */
export enum BetResult {
  WIN = 'WIN',
  LOSS = 'LOSS',
  PUSH = 'PUSH',
  VOID = 'VOID',
  HALF_WIN = 'HALF_WIN',
  HALF_LOSS = 'HALF_LOSS'
}

/**
 * Bet Category Enum
 * Defines the different categories of bets
 */
export enum BetCategory {
  SPORTS = 'SPORTS',
  ENTERTAINMENT = 'ENTERTAINMENT',
  POLITICS = 'POLITICS',
  FINANCE = 'FINANCE',
  CUSTOM = 'CUSTOM'
}

/**
 * Bet Market Type Enum
 * Defines the different market types for betting
 */
export enum BetMarketType {
  BINARY = 'BINARY',
  RANGE = 'RANGE',
  SCALAR = 'SCALAR',
  CATEGORICAL = 'CATEGORICAL'
}
