import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class OrderBookEntryDto {
  @ApiProperty({
    description: 'Price level',
    example: 105.50
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Quantity at this price level',
    example: 1000
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Total value (cumulative)',
    example: 105500
  })
  @IsNumber()
  total: number;
}

export class OrderBookDto {
  @ApiProperty({
    description: 'Bid orders (buy side)',
    type: [OrderBookEntryDto]
  })
  @IsArray()
  bids: OrderBookEntryDto[];

  @ApiProperty({
    description: 'Ask orders (sell side)',
    type: [OrderBookEntryDto]
  })
  @IsArray()
  asks: OrderBookEntryDto[];

  @ApiProperty({
    description: 'Current spread between best bid and ask',
    example: 0.50
  })
  @IsNumber()
  spread: number;

  @ApiProperty({
    description: 'Best bid price',
    example: 105.25
  })
  @IsNumber()
  bestBid: number;

  @ApiProperty({
    description: 'Best ask price',
    example: 105.75
  })
  @IsNumber()
  bestAsk: number;

  @ApiProperty({
    description: 'Mid price (average of best bid and ask)',
    example: 105.50
  })
  @IsNumber()
  midPrice: number;
}

export class PriceHistoryDto {
  @ApiProperty({
    description: 'Timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'Opening price',
    example: 100.00
  })
  @IsNumber()
  open: number;

  @ApiProperty({
    description: 'Highest price',
    example: 105.50
  })
  @IsNumber()
  high: number;

  @ApiProperty({
    description: 'Lowest price',
    example: 98.75
  })
  @IsNumber()
  low: number;

  @ApiProperty({
    description: 'Closing price',
    example: 104.25
  })
  @IsNumber()
  close: number;

  @ApiProperty({
    description: 'Trading volume',
    example: 50000
  })
  @IsNumber()
  volume: number;

  @ApiPropertyOptional({
    description: 'Virality score at this time',
    example: 75.5
  })
  @IsOptional()
  @IsNumber()
  viralityScore?: number;
}

export class MarketDataResponseDto {
  @ApiProperty({
    description: 'Trading symbol',
    example: 'VIRAL/SA_DJ_ZINHLE_001'
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Human-readable name',
    example: 'DJ Zinhle'
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Category',
    example: 'CELEB'
  })
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Region',
    example: 'SA'
  })
  @IsString()
  region: string;

  @ApiProperty({
    description: 'Current price',
    example: 105.50
  })
  @IsNumber()
  currentPrice: number;

  @ApiProperty({
    description: '24-hour price change',
    example: 5.50
  })
  @IsNumber()
  priceChange24h: number;

  @ApiProperty({
    description: '24-hour price change percentage',
    example: 5.50
  })
  @IsNumber()
  priceChangePercent24h: number;

  @ApiProperty({
    description: '24-hour trading volume',
    example: 1000000
  })
  @IsNumber()
  volume24h: number;

  @ApiProperty({
    description: '24-hour high price',
    example: 108.00
  })
  @IsNumber()
  high24h: number;

  @ApiProperty({
    description: '24-hour low price',
    example: 100.00
  })
  @IsNumber()
  low24h: number;

  @ApiProperty({
    description: 'Current virality score',
    example: 78.5
  })
  @IsNumber()
  viralityScore: number;

  @ApiProperty({
    description: 'Current velocity score',
    example: 0.0250
  })
  @IsNumber()
  velocity: number;

  @ApiProperty({
    description: 'Current sentiment score',
    example: 0.65
  })
  @IsNumber()
  sentiment: number;

  @ApiProperty({
    description: 'Total number of trades',
    example: 1500
  })
  @IsNumber()
  totalTrades: number;

  @ApiProperty({
    description: 'Market capitalization',
    example: 105500000
  })
  @IsNumber()
  marketCap: number;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z'
  })
  @IsString()
  lastUpdated: string;

  @ApiPropertyOptional({
    description: 'Order book data',
    type: OrderBookDto
  })
  @IsOptional()
  orderBook?: OrderBookDto;

  @ApiPropertyOptional({
    description: 'Price history data',
    type: [PriceHistoryDto]
  })
  @IsOptional()
  @IsArray()
  priceHistory?: PriceHistoryDto[];
}

export class TrendingMarketDto extends MarketDataResponseDto {
  @ApiProperty({
    description: 'Trending rank',
    example: 1
  })
  @IsNumber()
  rank: number;

  @ApiProperty({
    description: 'Calculated trend score',
    example: 95.5
  })
  @IsNumber()
  trendScore: number;
}