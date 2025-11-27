import { IsNumber, IsString, IsArray, IsNotEmpty } from 'class-validator';

export class OracleResponseDto {
  @IsString()
  @IsNotEmpty()
  trendId: string;

  @IsNumber()
  viralityScore: number;

  @IsNumber()
  confidence: number;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  proofHash: string;

  @IsString()
  @IsNotEmpty()
  merkleRoot: string;

  @IsArray()
  validatorSignatures: any[];

  @IsNumber()
  consensusLevel: number;

  @IsString()
  @IsOptional()
  networkType?: string;

  @IsNumber()
  @IsOptional()
  consensusStrength?: number;
}