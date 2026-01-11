import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Request,
  Response,
  Res,
  Redirect,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { OAuthService } from '../services/oauth.service';
import { ClientAttributionService, AttributionType } from '../services/client-attribution.service';
import { BrokersService } from '../services/brokers.service';
import { PrismaService } from "../../../prisma/prisma.service";
import { Response as ExpressResponse } from 'express';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  brokerId?: string;
}

interface OAuthState {
  userId: string;
  brokerId: string;
  provider: string;
  timestamp: number;
  nonce: string;
}

@ApiTags('brokers-link')
@Controller('brokers/link')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BrokersLinkController {
  private readonly logger = new Logger(BrokersLinkController.name);
  private redis: Redis;

  constructor(
    private readonly oauthService: OAuthService,
    private readonly clientAttributionService: ClientAttributionService,
    private readonly brokersService: BrokersService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD')
    });
  }

  @Post(':brokerId/oauth/:provider')
  @ApiOperation({ summary: 'Initiate OAuth linking flow for user' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID to link with' })
  @ApiParam({ name: 'provider', description: 'OAuth provider (google, apple, custom)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth flow initiated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Broker not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'OAuth not supported or broker not accepting clients' })
  async initiateLinking(
    @Param('brokerId') brokerId: string,
    @Param('provider') provider: string,
    @CurrentUser() user: AuthenticatedUser): Promise<any> {
    this.logger.log(`User ${user.id} initiating OAuth linking with broker ${brokerId} via ${provider}`);

    try {
      // Verify broker exists and is accepting new clients
      const broker = await this.brokersService.getBrokerById(brokerId);
      if (!broker) {
        throw new NotFoundException(`Broker not found: ${brokerId}`);
      }

      if (!broker.isActive) {
        throw new BadRequestException(`Broker is not active: ${brokerId}`);
      }

      if (!broker.acceptingNewClients) {
        throw new BadRequestException(`Broker is not accepting new clients: ${brokerId}`);
      }

      // Check if user is already linked to a broker
      if (user.brokerId) {
        throw new BadRequestException('User is already linked to a broker. Unlink first to link to a new broker.');
      }

      // Generate secure state with user and broker information
      const nonce = crypto.randomBytes(16).toString('hex');
      const state: OAuthState = {
        userId: user.id,
        brokerId,
        provider: provider.toUpperCase(),
        timestamp: Date.now(),
        nonce
      };

      const stateString = Buffer.from(JSON.stringify(state)).toString('base64');

      // Store state in Redis with 10-minute expiry
      await this.redis.setex(`oauth:link:state:${stateString}`, 600, JSON.stringify(state));

      // Generate redirect URI for frontend callback
      const redirectUri = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/brokers/link/callback`;

      // Call OAuth service to get authorization URL
      const authorizationUrl = await this.oauthService.initiateOAuthFlow(
        brokerId,
        provider,
        redirectUri);

      // Log the OAuth initiation for audit
      await this.prismaService.auditLog.create({
        data: {
          userId: user.id,
          action: 'OAUTH_LINK_INITIATED',
          details: {
            brokerId,
            provider,
            timestamp: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        data: {
          authorizationUrl,
          state: stateString,
          provider: provider.toUpperCase(),
          brokerName: broker.companyName,
          expiresAt: new Date(Date.now() + 600000).toISOString() // 10 minutes
        }
      };
    } catch (error) {
      this.logger.error(`Failed to initiate OAuth linking for user ${user.id}:`, error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to initiate OAuth linking');
    }
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle OAuth callback for user broker linking' })
  @ApiQuery({ name: 'code', required: true, description: 'OAuth authorization code' })
  @ApiQuery({ name: 'state', required: true, description: 'OAuth state parameter' })
  @ApiQuery({ name: 'error', required: false, description: 'OAuth error parameter' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth callback processed successfully' })
  @Redirect()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string): Promise<{ url: string }> {
    this.logger.log(`Processing OAuth callback with state: ${state.substring(0, 20)}...`);

    try {
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error('Missing required OAuth parameters: code or state');
      }

      // Retrieve and validate state from Redis
      const stateData = await this.redis.get(`oauth:link:state:${state}`);
      if (!stateData) {
        throw new UnauthorizedException('Invalid or expired state parameter');
      }

      const oauthState: OAuthState = JSON.parse(stateData);

      // Remove state from Redis to prevent replay
      await this.redis.del(`oauth:link:state:${state}`);

      // Validate state timestamp (must be within 10 minutes)
      const now = Date.now();
      if (now - oauthState.timestamp > 600000) { // 10 minutes
        throw new UnauthorizedException('State parameter has expired');
      }

      // Verify user still exists and is not linked to another broker
      const user = await this.prismaService.user.findUnique({
        where: { id: oauthState.userId }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.brokerId && user.brokerId !== oauthState.brokerId) {
        throw new BadRequestException('User is already linked to a different broker');
      }

      // Process OAuth callback with the OAuth service
      const oauthResult = await this.oauthService.handleOAuthCallback(code, state);

      if (!oauthResult.success) {
        throw new Error('OAuth callback processing failed');
      }

      // Attribute client to broker
      await this.clientAttributionService.attributeClientToBroker(
        oauthState.userId,
        oauthState.brokerId,
        AttributionType.OAUTH,
        {
          provider: oauthState.provider,
          linkedAt: new Date().toISOString(),
          oauthExpiry: oauthResult.expiresAt
        });

      // Update user record with broker ID
      await this.prismaService.user.update({
        where: { id: oauthState.userId },
        data: { brokerId: oauthState.brokerId }
      });

      // Get broker details for response
      const broker = await this.brokersService.getBrokerById(oauthState.brokerId);

      // Log successful linking for audit
      await this.prismaService.auditLog.create({
        data: {
          userId: oauthState.userId,
          action: 'OAUTH_LINK_COMPLETED',
          details: {
            brokerId: oauthState.brokerId,
            provider: oauthState.provider,
            linkedAt: new Date().toISOString()
          }
        }
      });

      this.logger.log(`Successfully linked user ${oauthState.userId} to broker ${oauthState.brokerId}`);

      // Redirect to frontend success page
      const successUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/settings/broker?linked=true&broker=${encodeURIComponent(broker.companyName)}`;

      return { url: successUrl };
    } catch (err) {
      this.logger.error(`OAuth callback processing failed:`, err);

      // Redirect to frontend error page with error details
      const errorUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/settings/broker?linked=false&error=${encodeURIComponent(err.message)}`;

      return { url: errorUrl };
    }
  }

  @Delete('/')
  @ApiOperation({ summary: 'Unlink user from current broker' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Successfully unlinked from broker' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'User is not linked to any broker' })
  @HttpCode(HttpStatus.OK)
  async unlinkBroker(
    @CurrentUser() user: AuthenticatedUser): Promise<any> {
    this.logger.log(`User ${user.id} requesting to unlink from broker`);

    try {
      if (!user.brokerId) {
        throw new BadRequestException('User is not linked to any broker');
      }

      // Get broker details for OAuth revocation
      const broker = await this.brokersService.getBrokerById(user.brokerId);
      if (!broker) {
        throw new NotFoundException(`Broker not found: ${user.brokerId}`);
      }

      // Get user's current broker-client attribution
      const brokerClients = await this.clientAttributionService.getBrokerClients(user.brokerId, {
        attributionType: AttributionType.OAUTH
      });

      const userAttribution = brokerClients.find(bc => bc.clientId === user.id);

      // Revoke OAuth access if attribution exists and has OAuth provider
      if (userAttribution?.metadata?.provider) {
        try {
          await this.oauthService.revokeOAuthAccess(
            user.brokerId,
            userAttribution.metadata.provider.toLowerCase());
        } catch (revokeError) {
          this.logger.warn(`Failed to revoke OAuth access for user ${user.id}:`, revokeError);
          // Continue with unlinking even if revocation fails
        }
      }

      // Deactivate client attribution
      if (userAttribution) {
        await this.clientAttributionService.updateClientStatus(
          user.brokerId,
          user.id,
          'INACTIVE' as any, // This would need to be added to ClientStatus enum
          'User unlinked via account settings');
      }

      // Update user record to remove broker ID
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { brokerId: null }
      });

      // Log unlinking for audit
      await this.prismaService.auditLog.create({
        data: {
          userId: user.id,
          action: 'OAUTH_LINK_REVOKED',
          details: {
            brokerId: user.brokerId,
            unlinkedAt: new Date().toISOString()
          }
        }
      });

      this.logger.log(`Successfully unlinked user ${user.id} from broker ${user.brokerId}`);

      return {
        success: true,
        data: {
          message: 'Successfully unlinked from broker',
          unlinkedAt: new Date().toISOString(),
          brokerName: broker.companyName
        }
      };
    } catch (error) {
      this.logger.error(`Failed to unlink user ${user.id} from broker:`, error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to unlink from broker');
    }
  }

  @Get('/status')
  @ApiOperation({ summary: 'Get current user broker linking status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Broker linking status retrieved successfully' })
  async getLinkingStatus(
    @CurrentUser() user: AuthenticatedUser): Promise<any> {
    try {
      if (!user.brokerId) {
        return {
          success: true,
          data: {
            isLinked: false,
            broker: null,
            linkedAt: null
          }
        };
      }

      // Get broker details
      const broker = await this.brokersService.getBrokerById(user.brokerId);
      if (!broker) {
        // Inconsistent state - user has brokerId but broker doesn't exist
        this.logger.warn(`User ${user.id} has invalid brokerId: ${user.brokerId}`);

        // Clean up the inconsistent state
        await this.prismaService.user.update({
          where: { id: user.id },
          data: { brokerId: null }
        });

        return {
          success: true,
          data: {
            isLinked: false,
            broker: null,
            linkedAt: null
          }
        };
      }

      // Get client attribution details
      const brokerClients = await this.clientAttributionService.getBrokerClients(user.brokerId, {
        attributionType: AttributionType.OAUTH
      });

      const userAttribution = brokerClients.find(bc => bc.clientId === user.id);

      return {
        success: true,
        data: {
          isLinked: true,
          broker: {
            id: broker.id,
            companyName: broker.companyName,
            logo: broker.logo,
            website: broker.website,
            status: broker.status
          },
          linkedAt: userAttribution?.attributionDate || null,
          oauthProvider: userAttribution?.metadata?.provider || null,
          oauthExpiry: userAttribution?.metadata?.oauthExpiry || null
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get linking status for user ${user.id}:`, error);
      throw new InternalServerErrorException('Failed to retrieve broker linking status');
    }
  }

  @Get('/available')
  @ApiOperation({ summary: 'Get list of available brokers for linking' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Available brokers retrieved successfully' })
  async getAvailableBrokers(): Promise<any> {
    try {
      const brokers = await this.brokersService.getBrokers({
        status: 'VERIFIED',
        isActive: true,
        acceptingNewClients: true
      });

      const availableBrokers = brokers.map(broker => ({
        id: broker.id,
        companyName: broker.companyName,
        logo: broker.logo,
        website: broker.website,
        description: broker.description,
        tier: broker.tier,
        oauthProviders: Object.keys(broker.oauthConfig || {}),
        minimumDeposit: broker.minimumDeposit,
        supportedAssets: broker.supportedAssets
      }));

      return {
        success: true,
        data: {
          brokers: availableBrokers,
          count: availableBrokers.length
        }
      };
    } catch (error) {
      this.logger.error('Failed to get available brokers:', error);
      throw new InternalServerErrorException('Failed to retrieve available brokers');
    }
  }
}
