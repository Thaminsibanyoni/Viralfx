import { IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  identifier?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  twoFactorCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceFingerprint?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userAgent?: string;
}