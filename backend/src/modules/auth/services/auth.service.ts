import { Injectable, Logger, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

// Import types from Prisma schema
import { User, UserRole, UserStatus, KycStatus } from '@prisma/client';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { Enable2FADto } from '../dto/enable-2fa.dto';
import { Verify2FADto } from '../dto/verify-2fa.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<{ user: User; tokens: any }> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: registerDto.email },
            { username: registerDto.username }
          ]
        }
      });

      if (existingUser) {
        throw new ConflictException('User with this email or username already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(registerDto.password, 12);

      // Create user with Prisma
      const savedUser = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          username: registerDto.username,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          country: registerDto.country || 'ZA',
          password: hashedPassword,
          isActive: true,
          emailVerified: false,
          role: UserRole.USER
        }
      });

      // Generate tokens
      const tokens = await this.generateTokens(savedUser);

      this.logger.log(`New user registered: ${savedUser.email}`);
      return { user: savedUser, tokens };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * User login
   */
  async login(loginDto: LoginDto): Promise<{ user: User; tokens: any; requires2FA: boolean }> {
    try {
      // Find user by email or username
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: loginDto.identifier },
            { username: loginDto.identifier }
          ]
        }
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        return {
          user,
          tokens: null,
          requires2FA: true
        };
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      await this.updateLastLogin(user.id);

      this.logger.log(`User logged in: ${user.email}`);
      return { user, tokens, requires2FA: false };
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Verify 2FA token
   */
  async verify2FA(verify2FADto: Verify2FADto): Promise<{ user: User; tokens: any }> {
    try {
      // Get temp user data from Redis
      const tempData = await this.redis.get(`2fa:${verify2FADto.sessionId}`);
      if (!tempData) {
        throw new UnauthorizedException('Invalid or expired 2FA session');
      }

      const user = await this.prisma.user.findUnique({ where: { id: JSON.parse(tempData).userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestException('2FA is not enabled for this user');
      }

      // Verify token
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: verify2FADto.token,
        window: 2 // Allow 2 time steps before/after
      });

      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA token');
      }

      // Clean up temp data
      await this.redis.del(`2fa:${verify2FADto.sessionId}`);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      await this.updateLastLogin(user.id);

      this.logger.log(`2FA verified for user: ${user.email}`);
      return { user, tokens };
    } catch (error) {
      this.logger.error('2FA verification failed:', error);
      throw error;
    }
  }

  /**
   * Enable 2FA for user
   */
  async enable2FA(userId: string, enable2FADto: Enable2FADto): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(enable2FADto.password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }

      if (user.twoFactorEnabled) {
        throw new BadRequestException('2FA is already enabled');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `ViralFX (${user.email})`,
        issuer: 'ViralFX',
        length: 32
      });

      // Generate QR code
      const qrCode = speakeasy.otpauthURL({
        secret: secret.base32,
        label: `ViralFX (${user.email})`,
        issuer: 'ViralFX'
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store secret temporarily (require verification)
      await this.redis.setex(
        `2fa_setup:${userId}`,
        300, // 5 minutes
        JSON.stringify({
          secret: secret.base32,
          backupCodes: backupCodes.map(code => bcrypt.hash(code, 12))
        })
      );

      this.logger.log(`2FA setup initiated for user: ${user.email}`);
      return {
        secret: secret.base32,
        qrCode,
        backupCodes
      };
    } catch (error) {
      this.logger.error('Failed to enable 2FA:', error);
      throw error;
    }
  }

  /**
   * Confirm 2FA setup
   */
  async confirm2FASetup(userId: string, token: string): Promise<void> {
    try {
      const setupData = await this.redis.get(`2fa_setup:${userId}`);
      if (!setupData) {
        throw new BadRequestException('2FA setup session expired');
      }

      const { secret, backupCodes } = JSON.parse(setupData);

      // Verify token
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!isValid) {
        throw new UnauthorizedException('Invalid verification token');
      }

      // Update user
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret
        }
      });

      // Clean up
      await this.redis.del(`2fa_setup:${userId}`);

      this.logger.log(`2FA confirmed for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to confirm 2FA setup:', error);
      throw error;
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, password: string, token: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.twoFactorEnabled) {
        throw new BadRequestException('2FA is not enabled');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }

      // Verify 2FA token
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA token');
      }

      // Disable 2FA
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null
        }
      });

      this.logger.log(`2FA disabled for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to disable 2FA:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET')
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const tokens = await this.generateTokens(user);

      this.logger.log(`Token refreshed for user: ${user.email}`);
      return { accessToken: tokens.accessToken };
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword
        }
      });

      // Invalidate all refresh tokens
      await this.invalidateUserTokens(userId);

      this.logger.log(`Password changed for user: ${userId}`);
    } catch (error) {
      this.logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      // Add refresh token to blacklist
      await this.redis.setex(
        `blacklist:${refreshToken}`,
        7 * 24 * 60 * 60, // 7 days
        '1'
      );

      // Invalidate user sessions
      await this.invalidateUserTokens(userId);

      this.logger.log(`User logged out: ${userId}`);
    } catch (error) {
      this.logger.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET')
      });

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return user;
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m')
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')
    });

    return { accessToken, refreshToken };
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date()
      }
    });
  }

  /**
   * Invalidate all user tokens
   */
  private async invalidateUserTokens(userId: string): Promise<void> {
    // Store invalidated user ID with timestamp
    await this.redis.setex(
      `invalidated:${userId}`,
      7 * 24 * 60 * 60, // 7 days
      new Date().toISOString()
    );
  }

  /**
   * Check if token is invalidated
   */
  async isTokenInvalidated(userId: string, tokenTime: number): Promise<boolean> {
    const invalidatedTime = await this.redis.get(`invalidated:${userId}`);
    if (!invalidatedTime) return false;

    return new Date(invalidatedTime).getTime() > tokenTime;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  /**
   * Generate session ID for 2FA
   */
  generate2FASessionId(userId: string): string {
    return `2fa_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store 2FA session data
   */
  async store2FASession(sessionId: string, userId: string): Promise<void> {
    await this.redis.setex(
      `2fa:${sessionId}`,
      300, // 5 minutes
      JSON.stringify({ userId })
    );
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Remove sensitive fields that shouldn't be updated via this method
      const { password, twoFactorSecret, id, createdAt, updatedAt, ...allowedUpdates } = profileData;

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: allowedUpdates
      });

      this.logger.log(`Profile updated for user: ${userId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): { isStrong: boolean; issues: string[] } {
    const issues = [];

    if (password.length < 8) {
      issues.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      issues.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      issues.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain at least one special character');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      issues.push('Password is too common');
    }

    return {
      isStrong: issues.length === 0,
      issues
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // This would typically query other services for user statistics
      return {
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        role: user.role
      };
    } catch (error) {
      this.logger.error('Failed to get user stats:', error);
      throw error;
    }
  }
}
