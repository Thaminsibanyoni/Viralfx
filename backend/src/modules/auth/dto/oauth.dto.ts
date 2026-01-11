import { IsString, IsNotEmpty, IsEmail, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OAuthCallbackDto {
  @ApiProperty({
    description: "OAuth provider",
    example: "google",
    enum: ["google", "apple", "facebook"]
  })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({
    description: "Authorization code from OAuth provider"
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: "State parameter for CSRF protection"
  })
  @IsString()
  @IsOptional()
  state?: string;
}

export class OAuthProfileDto {
  @ApiProperty({ description: "Provider name" })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ description: "User email" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "First name" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: "Last name" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ description: "Profile picture URL" })
  @IsString()
  @IsOptional()
  picture?: string;

  @ApiProperty({ description: "Access token" })
  @IsString()
  @IsOptional()
  accessToken?: string;
}