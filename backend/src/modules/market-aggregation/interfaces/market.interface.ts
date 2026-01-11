export interface Market {
  id: string;
  symbol: string;
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  price?: number;
  volume24h?: number;
  change24h?: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt?: Date;
  updatedAt?: Date;
}
