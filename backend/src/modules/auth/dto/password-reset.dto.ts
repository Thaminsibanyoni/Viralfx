import { IsEmail, IsString, IsNotEmpty, IsOptional, Matches, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com"
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: "Reset token",
    example: "abc123xyz789"
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: "New password"
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character'
  })
  newPassword: string;

  @ApiProperty({
    description: "Confirm new password"
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}