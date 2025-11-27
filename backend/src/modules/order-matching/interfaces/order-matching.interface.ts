export interface ExecutionResult {
  success: boolean;
  order: any;
  matches: MatchResult[];
  errors: string[];
}

export interface MatchResult {
  bidOrderId: string;
  askOrderId: string;
  quantity: number;
  price: number;
  bidUserId: string;
  askUserId: string;
  timestamp: Date;
  tradeId: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SettlementResult {
  success: boolean;
  betId: string;
  payout: number;
  status: string;
  timestamp: Date;
}

export interface RecordTransactionParams {
  walletId: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: object;
  referenceId?: string;
  referenceType?: string;
}

export interface ConversionResult {
  fromWalletId: string;
  toWalletId: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  fee: number;
  transactions: any[];
}

export interface PortfolioValue {
  totalValueZAR: number;
  totalValueUSD: number;
  wallets: Array<{
    currency: string;
    balance: number;
    valueZAR: number;
    valueUSD: number;
  }>;
  lastUpdated: Date;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: {
    type?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReconciliationResult {
  walletId: string;
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number;
  isReconciled: boolean;
  transactionCount: number;
  lastReconciled: Date;
}

export interface DepositInitiation {
  transactionId: string;
  checkoutUrl: string;
  reference: string;
  estimatedProcessingTime: number;
}

export interface WithdrawalInitiation {
  transactionId: string;
  estimatedProcessingTime: number;
  requirements?: {
    verification?: string;
    twoFactor?: boolean;
    manualReview?: boolean;
  };
}

export interface WithdrawalDestination {
  type: 'BANK_ACCOUNT' | 'CRYPTO_ADDRESS';
  details: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    routingNumber?: string;
    swiftCode?: string;
    cryptoAddress?: string;
    network?: string;
    memo?: string;
  };
}