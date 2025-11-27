import { IsNumber, IsString, IsArray, IsNotEmpty } from 'class-validator';

export class ConsensusRequestDto {
  @IsString()
  @IsNotEmpty()
  trendId: string;

  @IsArray()
  validatorIds: string[];

  @IsNumber()
  requiredAgreement: number;

  @IsNumber()
  maxVariance: number;
}

export class ConsensusResponseDto {
  @IsString()
  @IsNotEmpty()
  trendId: string;

  @IsNumber()
  score: number;

  @IsNumber()
  confidence: number;

  @IsNumber()
  timestamp: number;

  @IsNumber()
  agreement: number;

  @IsNumber()
  consensusStrength: number;

  @IsArray()
  validatorResponses: any[];

  @IsString()
  @IsOptional()
  status?: string;
}