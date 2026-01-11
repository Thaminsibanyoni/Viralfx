import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class PositionDto {
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
    description: 'Quantity held',
    example: 1000
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Average entry price',
    example: 100.00
  })
  @IsNumber()
  averagePrice: number;

  @ApiProperty({
    description: 'Current market price',
    example: 105.50
  })
  @IsNumber()
  currentPrice: number;

  @ApiProperty({
    description: 'Total cost of position',
    example: 100000
  })
  @IsNumber()
  totalCost: number;

  @ApiProperty({
    description: 'Current value of position',
    example: 105500
  })
  @IsNumber()
  currentValue: number;

  @ApiProperty({
    description: 'Unrealized profit/loss',
    example: 5500
  })
  @IsNumber()
  unrealizedPnL: number;

  @ApiProperty({
    description: 'Unrealized profit/loss percentage',
    example: 5.50
  })
  @IsNumber()
  unrealizedPnLPercent: number;

  @ApiProperty({
    description: 'Realized profit/loss',
    example: 1200
  })
  @IsNumber()
  realizedPnL: number;

  @ApiProperty({
    description: 'Total profit/loss',
    example: 6700
  })
  @IsNumber()
  totalPnL: number;

  @ApiProperty({
    description: 'Portfolio allocation percentage',
    example: 15.25
  })
  @IsNumber()
  allocation: number;

  @ApiProperty({
    description: 'First purchase date',
    example: '2024-01-01T10:00:00Z'
  })
  @IsString()
  firstPurchaseAt: string;

  @ApiProperty({
    description: 'Last trade date',
    example: '2024-01-15T14:30:00Z'
  })
  @IsString()
  lastTradeAt: string;
}

export class PortfolioSummaryDto {
  @ApiProperty({
    description: 'Total number of positions',
    example: 12
  })
  @IsNumber()
  totalPositions: number;

  @ApiProperty({
    description: 'Number of profitable positions',
    example: 8
  })
  @IsNumber()
  profitablePositions: number;

  @ApiProperty({
    description: 'Number of losing positions',
    example: 4
  })
  @IsNumber()
  losingPositions: number;

  @ApiProperty({
    description: 'Win rate percentage',
    example: 66.67
  })
  @IsNumber()
  winRate: number;

  @ApiPropertyOptional({
    description: 'Best performing position',
    type: PositionDto
  })
  @IsOptional()
  bestPerformer?: PositionDto;

  @ApiPropertyOptional({
    description: 'Worst performing position',
    type: PositionDto
  })
  @IsOptional()
  worstPerformer?: PositionDto;

  @ApiPropertyOptional({
    description: 'Largest position by value',
    type: PositionDto
  })
  @IsOptional()
  largestPosition?: PositionDto;

  @ApiProperty({
    description: 'Diversification score (0-100)',
    example: 75.5
  })
  @IsNumber()
  diversificationScore: number;
}

export class PortfolioResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-string'
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Total portfolio value',
    example: 500000
  })
  @IsNumber()
  totalValue: number;

  @ApiProperty({
    description: 'Total cost basis',
    example: 450000
  })
  @IsNumber()
  totalCost: number;

  @ApiProperty({
    description: 'Total profit/loss',
    example: 50000
  })
  @IsNumber()
  totalPnL: number;

  @ApiProperty({
    description: 'Total profit/loss percentage',
    example: 11.11
  })
  @IsNumber()
  totalPnLPercent: number;

  @ApiProperty({
    description: 'Portfolio positions',
    type: [PositionDto]
  })
  @IsArray()
  positions: PositionDto[];

  @ApiProperty({
    description: 'Portfolio summary statistics',
    type: PortfolioSummaryDto
  })
  summary: PortfolioSummaryDto;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T15:30:00Z'
  })
  @IsString()
  lastUpdated: string;
}
