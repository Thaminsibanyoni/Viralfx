// Transaction entity removed;

export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRADE_BUY"
  | "TRADE_SELL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "BET_STAKE"
  | "BET_PAYOUT"
  | "BET_REFUND"
  | "FEE"
  | "COMMISSION"
  | "LOCK"
  | "UNLOCK";

export interface Transaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  balance_before: number;
  balance_after: number;
  description: string;
  metadata?: Record<string, any>;
  reference_id?: string;
  reference_type?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  total_balance: number;
  status: "ACTIVE" | "INACTIVE" | "FROZEN" | "CLOSED";
  created_at: Date;
  updated_at: Date;
  last_activity?: Date;
}

export interface WalletBalance {
  walletId: string;
  currency: string;
  available_balance: number;
  total_balance: number;
  pending_balance: number;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface TransactionHistoryOptions {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "amount" | "type" | "status";
  sortOrder?: "asc" | "desc";
  filters?: TransactionFilters;
}

export interface TransferRequest {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface WalletSummary {
  totalValueZAR: number;
  totalValueUSD: number;
  currencies: Array<{
  currency: string;
  balance: number;
  valueZAR: number;
  valueUSD: number;
  }>;
  lastUpdated: Date;
}





