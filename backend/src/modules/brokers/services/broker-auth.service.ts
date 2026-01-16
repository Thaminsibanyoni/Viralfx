import { Injectable, Logger, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Broker, BrokerStatus } from '@prisma/client';
import { BrokerLoginDto, BrokerRefreshDto } from '../dto/broker-auth.dto';

export interface BrokerTokens {
  accessToken: string;
  refreshToken: string;
}

export interface BrokerLoginResponse {
  broker: Omit<Broker, 'password' | 'twoFactorSecret'>;
  tokens: BrokerTokens;
}

@Injectable()
export class BrokerAuthService {
  private readonly logger = new Logger(BrokerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validate broker credentials
   */
  async validateBroker(email: string, password: string, clientIp?: string): Promise<Broker> {
    try {
      // Find broker by email
      const broker = await this.prisma.broker.findFirst({
        where: {
          contactEmail: email
        }
      });

      if (!broker) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if broker is active and verified
      if (broker.status !== BrokerStatus.VERIFIED || !broker.isActive) {
        throw new ForbiddenException('Broker account is not active or verified');
      }

      // Check if account is locked
      if (broker.lockedUntil && broker.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((broker.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        throw new ForbiddenException(`Account is locked. Try again in ${minutesLeft} minutes`);
      }

      // Verify password
      if (!broker.password) {
        throw new UnauthorizedException('Password not set for this broker account');
      }

      const isPasswordValid = await bcrypt.compare(password, broker.password);

      if (!isPasswordValid) {
        // Increment login attempts
        const newAttempts = (broker.loginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (newAttempts >= 5) {
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

          await this.prisma.broker.update({
            where: { id: broker.id },
            data: {
              loginAttempts: newAttempts,
              lockedUntil: lockUntil
            }
          });

          this.logger.warn(`Broker account locked due to failed attempts: ${broker.contactEmail}`);
          throw new ForbiddenException('Account locked due to too many failed attempts. Try again in 30 minutes');
        }

        // Update attempts
        await this.prisma.broker.update({
          where: { id: broker.id },
          data: {
            loginAttempts: newAttempts
          }
        });

        throw new UnauthorizedException('Invalid credentials');
      }

      // Reset login attempts on successful login
      await this.prisma.broker.update({
        where: { id: broker.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: clientIp || null
        }
      });

      this.logger.log(`Broker logged in successfully: ${broker.contactEmail}`);
      return broker;

    } catch (error) {
      this.logger.error('Broker validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens for broker
   */
  async generateTokens(broker: Broker): Promise<BrokerTokens> {
    const payload = {
      brokerId: broker.id,
      email: broker.contactEmail,
      companyName: broker.companyName,
      type: 'broker',
      tier: broker.tier,
      status: broker.status
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
   * Broker login
   */
  async login(loginDto: BrokerLoginDto): Promise<BrokerLoginResponse> {
    try {
      // Validate credentials
      const broker = await this.validateBroker(
        loginDto.email,
        loginDto.password,
        loginDto.clientIp
      );

      // Generate tokens
      const tokens = await this.generateTokens(broker);

      // Remove sensitive data from broker object
      const { password: _, twoFactorSecret: __, ...brokerResponse } = broker;

      return {
        broker: brokerResponse,
        tokens
      };
    } catch (error) {
      this.logger.error('Broker login failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refresh(refreshDto: BrokerRefreshDto): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshDto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET')
      });

      // Check if this is a broker token
      if (payload.type !== 'broker' || !payload.brokerId) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Find broker
      const broker = await this.prisma.broker.findUnique({
        where: { id: payload.brokerId }
      });

      if (!broker) {
        throw new UnauthorizedException('Broker not found');
      }

      // Check if broker is still active
      if (broker.status !== BrokerStatus.VERIFIED || !broker.isActive) {
        throw new ForbiddenException('Broker account is not active');
      }

      // Generate new access token
      const newPayload = {
        brokerId: broker.id,
        email: broker.contactEmail,
        companyName: broker.companyName,
        type: 'broker',
        tier: broker.tier,
        status: broker.status
      };

      const accessToken = this.jwtService.sign(newPayload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m')
      });

      this.logger.log(`Token refreshed for broker: ${broker.contactEmail}`);
      return { accessToken };
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Get broker profile
   */
  async getProfile(brokerId: string): Promise<Omit<Broker, 'password' | 'twoFactorSecret'>> {
    try {
      const broker = await this.prisma.broker.findUnique({
        where: { id: brokerId }
      });

      if (!broker) {
        throw new UnauthorizedException('Broker not found');
      }

      // Remove sensitive data
      const { password: _, twoFactorSecret: __, ...brokerResponse } = broker;

      return brokerResponse;
    } catch (error) {
      this.logger.error('Failed to get broker profile:', error);
      throw error;
    }
  }

  /**
   * Logout broker (optional - can be used to invalidate tokens if needed)
   */
  async logout(brokerId: string): Promise<void> {
    try {
      this.logger.log(`Broker logged out: ${brokerId}`);

      // In a stateless JWT system, logout is mostly client-side
      // If you want to implement server-side logout, you would:
      // 1. Add the token to a blacklist in Redis
      // 2. Check the blacklist in the guard
      // For now, this is just a logging function
    } catch (error) {
      this.logger.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Change broker password
   */
  async changePassword(brokerId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const broker = await this.prisma.broker.findUnique({
        where: { id: brokerId }
      });

      if (!broker) {
        throw new UnauthorizedException('Broker not found');
      }

      // Verify current password
      if (!broker.password) {
        throw new BadRequestException('Password not set for this account');
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, broker.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await this.prisma.broker.update({
        where: { id: brokerId },
        data: {
          password: hashedPassword
        }
      });

      this.logger.log(`Password changed for broker: ${broker.contactEmail}`);
    } catch (error) {
      this.logger.error('Password change failed:', error);
      throw error;
    }
  }
}
