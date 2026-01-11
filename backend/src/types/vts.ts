// VTS (Viral Trading System) Type Definitions

export enum VTSSymbol {
  // Example symbols
  BTC = 'BTC',
  ETH = 'ETH',
  USDT = 'USDT'
}

export enum RegionCode {
  US = 'US',
  EU = 'EU',
  ASIA = 'ASIA',
  GLOBAL = 'GLOBAL'
}

export enum CategoryCode {
  CRYPTOCURRENCY = 'CRYPTOCURRENCY',
  STOCK = 'STOCK',
  COMMODITY = 'COMMODITY',
  FOREX = 'FOREX',
  INDEX = 'INDEX'
}

export enum VerificationLevel {
  UNVERIFIED = 'UNVERIFIED',
  BASIC = 'BASIC',
  VERIFIED = 'VERIFIED',
  PREMIUM = 'PREMIUM',
  INSTITUTIONAL = 'INSTITUTIONAL'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME'
}

export interface VTSEntry {
  symbol: VTSSymbol;
  region: RegionCode;
  category: CategoryCode;
  verificationLevel: VerificationLevel;
  riskLevel: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface VTSRegistryEntry extends VTSEntry {
  id: string;
  metadata?: Record<string, any>;
}
