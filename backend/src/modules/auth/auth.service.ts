import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto, RegisterDto, RefreshTokenDto, Enable2FADto, Verify2FADto } from './dto';
import { JwtPayload, TokenPair } from './interfaces';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: any; tokens: TokenPair }> {
    this.logger.log(`Registration attempt for email: ${dto.email}`);

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      if (existingUser.username === dto.username) {
        throw new ConflictException('Username already taken');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Generate referral code
    const referralCode = this.generateReferralCode();

    // Create user with transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          referralCode,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: false,
          twoFactorEnabled: false,
          createdAt: true,
        },
      });

      // Create welcome bonus transaction if enabled
      if (this.config.get('WELCOME_BONUS_ENABLED', false)) {
        const bonusAmount = this.config.get('WELCOME_BONUS_AMOUNT', 10);
        await tx.transaction.create({
          data: {
            userId: newUser.id,
            type: 'BONUS',
            amount: bonusAmount,
            currency: 'USD',
            status: 'COMPLETED',
            description: 'Welcome bonus',
            metadata: { type: 'WELCOME_BONUS' },
            balanceBefore: 0,
            balanceAfter: bonusAmount,
          },
        });

        // Update user balance
        await tx.user.update({
          where: { id: newUser.id },
          data: { balanceUsd: bonusAmount },
        });
      }

      return newUser;
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken);

    this.logger.log(`User registered successfully: ${user.email}`);

    return {
      user,
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<any> {
    this.logger.log(`Login attempt for email: ${dto.email}`);

    // Find user with login attempt tracking
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      this.logger.warn(`Login attempt for inactive account: ${dto.email}`);
      throw new UnauthorizedException('Account is not active');
    }

    // Check if account is temporarily locked due to failed attempts
    const loginAttempts = await this.getLoginAttempts(user.id);
    if (loginAttempts >= this.MAX_ATTEMPTS) {
      const lastAttempt = await this.getLastLoginAttempt(user.id);
      if (lastAttempt && Date.now() - lastAttempt.getTime() < this.LOCK_TIME) {
        throw new UnauthorizedException('Account temporarily locked. Please try again later.');
      }
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      await this.recordLoginAttempt(user.id, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check 2FA
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        return {
          requiresTwoFactor: true,
          userId: user.id,
          message: 'Please enter your 2FA code',
        };
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: dto.twoFactorCode,
        window: 2, // Allow 2 time steps
      });

      if (!verified) {
        await this.recordLoginAttempt(user.id, false);
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Clear login attempts on successful login
    await this.clearLoginAttempts(user.id);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: dto.ipAddress,
        deviceFingerprint: dto.deviceFingerprint,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    this.logger.log(`User logged in successfully: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        balanceUsd: user.balanceUsd,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Check session
      const session = await this.prisma.session.findUnique({
        where: { refreshToken: dto.refreshToken },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      if (session.user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User account is not active');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(payload.sub, session.user.email);

      // Update session
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      this.logger.log(`Token refreshed for user: ${session.user.email}`);

      return tokens;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, token: string): Promise<{ message: string }> {
    // Delete session
    await this.prisma.session.deleteMany({
      where: {
        userId,
        token,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: userId,
      },
    });

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  async logoutAllSessions(userId: string): Promise<{ message: string }> {
    // Delete all sessions for user
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT_ALL',
        entity: 'User',
        entityId: userId,
      },
    });

    this.logger.log(`All sessions terminated for user: ${userId}`);

    return { message: 'All sessions terminated successfully' };
  }

  async enable2FA(userId: string, dto: Enable2FADto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password before enabling 2FA
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `ViralFX (${user.email})`,
      issuer: 'ViralFX',
      length: 32,
    });

    // Temporarily store secret (not enabling yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url,
      backupCodes: this.generateBackupCodes(),
    };
  }

  async verify2FA(userId: string, dto: Verify2FADto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: dto.token,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: '2FA_ENABLED',
        entity: 'User',
        entityId: userId,
      },
    });

    this.logger.log(`2FA enabled for user: ${user.email}`);

    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: '2FA_DISABLED',
        entity: 'User',
        entityId: userId,
      },
    });

    this.logger.log(`2FA disabled for user: ${user.email}`);

    return { message: '2FA disabled successfully' };
  }

  private async generateTokens(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      iat: Math.floor(Date.now() / 1000),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    };
  }

  private async createSession(
    userId: string,
    token: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.session.create({
      data: {
        userId,
        token,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(uuidv4().split('-')[0].toUpperCase());
    }
    return codes;
  }

  private async getLoginAttempts(userId: string): Promise<number> {
    const attempts = await this.prisma.auditLog.count({
      where: {
        userId,
        action: 'LOGIN_FAILED',
        createdAt: {
          gte: new Date(Date.now() - this.LOCK_TIME),
        },
      },
    });
    return attempts;
  }

  private async getLastLoginAttempt(userId: string): Promise<Date | null> {
    const lastAttempt = await this.prisma.auditLog.findFirst({
      where: {
        userId,
        action: 'LOGIN_FAILED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });
    return lastAttempt?.createdAt || null;
  }

  private async recordLoginAttempt(userId: string, success: boolean): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
        entity: 'User',
        entityId: userId,
      },
    });
  }

  private async clearLoginAttempts(userId: string): Promise<void> {
    await this.prisma.auditLog.deleteMany({
      where: {
        userId,
        action: 'LOGIN_FAILED',
      },
    });
  }
}