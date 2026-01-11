import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateReferralDto {
  @IsString()
  referrerId: string;

  @IsString()
  referredUserId: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateReferralDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  rewardPoints?: number;
}

export class ClaimRewardDto {
  @IsString()
  referralId: string;

  @IsString()
  userId: string;
}

export class ReferralStatsDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
