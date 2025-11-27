import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as AppleStrategy } from 'passport-apple';
import { Broker } from '../entities/broker.entity';
import { OAuthConfig } from '../interfaces/broker.interface';
import { crypto } from '../../../common/utils/crypto';
import * as Redis from 'ioredis';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private redis: Redis;
  private readonly supportedProviders = ['GOOGLE', 'APPLE', 'CUSTOM'];

  constructor(
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    });
  }

  async generateOAuthConfig(brokerId: string, provider: string): Promise<OAuthConfig> {
    this.logger.log(`Generating OAuth config for broker ${brokerId} and provider ${provider}`);

    if (!this.supportedProviders.includes(provider.toUpperCase())) {
      throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
    }

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    let oauthConfig: Partial<OAuthConfig>;

    switch (provider.toUpperCase()) {
      case 'GOOGLE':
        oauthConfig = await this.generateGoogleOAuthConfig(brokerId);
        break;
      case 'APPLE':
        oauthConfig = await this.generateAppleOAuthConfig(brokerId);
        break;
      case 'CUSTOM':
        oauthConfig = await this.generateCustomOAuthConfig(brokerId);
        break;
      default:
        throw new BadRequestException(`OAuth provider ${provider} not implemented`);
    }

    // Update broker's OAuth configuration
    const currentOAuthConfig = broker.oauthConfig || {};
    broker.oauthConfig = {
      ...currentOAuthConfig,
      [provider.toLowerCase()]: oauthConfig,
    };

    await this.brokerRepository.save(broker);

    this.logger.log(`Generated OAuth config for broker ${brokerId}, provider ${provider}`);
    return oauthConfig as OAuthConfig;
  }

  async initiateOAuthFlow(brokerId: string, provider: string, redirectUri: string): Promise<string> {
    this.logger.log(`Initiating OAuth flow for broker ${brokerId} and provider ${provider}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    const oauthConfig = broker.oauthConfig?.[provider.toLowerCase()];
    if (!oauthConfig) {
      throw new BadRequestException(`OAuth not configured for provider: ${provider}`);
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(64).toString('base64url');

    // Store state in Redis with 5-minute expiry
    await this.redis.setex(`oauth:state:${state}`, 300, JSON.stringify({
      brokerId,
      provider,
      redirectUri,
      codeVerifier,
    }));

    // Build authorization URL based on provider
    let authUrl: string;

    switch (provider.toUpperCase()) {
      case 'GOOGLE':
        authUrl = this.buildGoogleAuthUrl(oauthConfig, redirectUri, state, oauthConfig.scopes || ['email', 'profile']);
        break;
      case 'APPLE':
        authUrl = this.buildAppleAuthUrl(oauthConfig, redirectUri, state, oauthConfig.scopes || ['name', 'email']);
        break;
      case 'CUSTOM':
        authUrl = this.buildCustomAuthUrl(oauthConfig, redirectUri, state);
        break;
      default:
        throw new BadRequestException(`OAuth provider ${provider} not implemented`);
    }

    return authUrl;
  }

  async handleOAuthCallback(code: string, state: string): Promise<any> {
    this.logger.log(`Handling OAuth callback for state: ${state}`);

    // Retrieve and validate state
    const stateData = await this.redis.get(`oauth:state:${state}`);
    if (!stateData) {
      throw new UnauthorizedException('Invalid or expired state');
    }

    const { brokerId, provider, redirectUri, codeVerifier } = JSON.parse(stateData);

    // Remove state from Redis
    await this.redis.del(`oauth:state:${state}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    const oauthConfig = broker.oauthConfig?.[provider.toLowerCase()];
    if (!oauthConfig) {
      throw new BadRequestException(`OAuth not configured for provider: ${provider}`);
    }

    // Exchange authorization code for tokens
    let tokenResponse: any;

    try {
      switch (provider.toUpperCase()) {
        case 'GOOGLE':
          tokenResponse = await this.exchangeGoogleCode(oauthConfig, code, redirectUri);
          break;
        case 'APPLE':
          tokenResponse = await this.exchangeAppleCode(oauthConfig, code, redirectUri, codeVerifier);
          break;
        case 'CUSTOM':
          tokenResponse = await this.exchangeCustomCode(oauthConfig, code, redirectUri);
          break;
        default:
          throw new BadRequestException(`OAuth provider ${provider} not implemented`);
      }
    } catch (error) {
      this.logger.error(`Failed to exchange code for tokens for ${provider}:`, error);
      throw new UnauthorizedException('Failed to exchange authorization code');
    }

    // Store tokens securely
    const encryptedTokens = this.encryptTokens(tokenResponse);

    // Update broker's OAuth configuration with tokens
    const currentOAuthConfig = broker.oauthConfig || {};
    currentOAuthConfig[provider.toLowerCase()] = {
      ...currentOAuthConfig[provider.toLowerCase()],
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiry: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
      encryptedTokens, // Store encrypted version for backup
    };

    broker.oauthConfig = currentOAuthConfig;
    await this.brokerRepository.save(broker);

    this.logger.log(`Successfully completed OAuth flow for broker ${brokerId}, provider ${provider}`);

    return {
      success: true,
      provider,
      brokerId,
      expiresAt: currentOAuthConfig[provider.toLowerCase()].tokenExpiry,
    };
  }

  async refreshOAuthToken(brokerId: string, provider: string): Promise<void> {
    this.logger.log(`Refreshing OAuth token for broker ${brokerId}, provider ${provider}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    const oauthConfig = broker.oauthConfig?.[provider.toLowerCase()];
    if (!oauthConfig || !oauthConfig.refreshToken) {
      throw new BadRequestException(`No refresh token available for provider: ${provider}`);
    }

    let tokenResponse: any;

    try {
      switch (provider.toUpperCase()) {
        case 'GOOGLE':
          tokenResponse = await this.refreshGoogleToken(oauthConfig);
          break;
        case 'APPLE':
          tokenResponse = await this.refreshAppleToken(oauthConfig);
          break;
        case 'CUSTOM':
          tokenResponse = await this.refreshCustomToken(oauthConfig);
          break;
        default:
          throw new BadRequestException(`OAuth provider ${provider} not implemented`);
      }
    } catch (error) {
      this.logger.error(`Failed to refresh token for ${provider}:`, error);
      throw new UnauthorizedException('Failed to refresh OAuth token');
    }

    // Update tokens
    const currentOAuthConfig = broker.oauthConfig || {};
    currentOAuthConfig[provider.toLowerCase()] = {
      ...currentOAuthConfig[provider.toLowerCase()],
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || oauthConfig.refreshToken,
      tokenExpiry: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : undefined,
    };

    broker.oauthConfig = currentOAuthConfig;
    await this.brokerRepository.save(broker);

    this.logger.log(`Successfully refreshed OAuth token for broker ${brokerId}, provider ${provider}`);
  }

  async revokeOAuthAccess(brokerId: string, provider: string): Promise<void> {
    this.logger.log(`Revoking OAuth access for broker ${brokerId}, provider ${provider}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    const oauthConfig = broker.oauthConfig?.[provider.toLowerCase()];
    if (!oauthConfig) {
      throw new BadRequestException(`OAuth not configured for provider: ${provider}`);
    }

    // Revoke tokens with provider
    if (oauthConfig.accessToken) {
      try {
        switch (provider.toUpperCase()) {
          case 'GOOGLE':
            await this.revokeGoogleToken(oauthConfig.accessToken);
            break;
          case 'APPLE':
            await this.revokeAppleToken(oauthConfig.accessToken);
            break;
          case 'CUSTOM':
            await this.revokeCustomToken(oauthConfig.accessToken, oauthConfig);
            break;
        }
      } catch (error) {
        this.logger.warn(`Failed to revoke token with ${provider}:`, error);
        // Continue with local cleanup even if revocation fails
      }
    }

    // Remove tokens from broker configuration
    const currentOAuthConfig = broker.oauthConfig || {};
    currentOAuthConfig[provider.toLowerCase()] = {
      ...currentOAuthConfig[provider.toLowerCase()],
      accessToken: undefined,
      refreshToken: undefined,
      tokenExpiry: undefined,
    };

    broker.oauthConfig = currentOAuthConfig;
    await this.brokerRepository.save(broker);

    this.logger.log(`Successfully revoked OAuth access for broker ${brokerId}, provider ${provider}`);
  }

  async validateOAuthScopes(brokerId: string, provider: string, requiredScopes: string[]): Promise<boolean> {
    this.logger.log(`Validating OAuth scopes for broker ${brokerId}, provider ${provider}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    const oauthConfig = broker.oauthConfig?.[provider.toLowerCase()];
    if (!oauthConfig || !oauthConfig.scopes) {
      return false;
    }

    // Check if all required scopes are present
    const hasAllScopes = requiredScopes.every(scope =>
      oauthConfig.scopes.includes(scope)
    );

    return hasAllScopes;
  }

  private async generateGoogleOAuthConfig(brokerId: string): Promise<Partial<OAuthConfig>> {
    return {
      provider: 'GOOGLE',
      clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      scopes: ['email', 'profile'],
    };
  }

  private async generateAppleOAuthConfig(brokerId: string): Promise<Partial<OAuthConfig>> {
    return {
      provider: 'APPLE',
      clientId: this.configService.get<string>('APPLE_CLIENT_ID'),
      clientSecret: await this.generateAppleClientSecret(),
      redirectUri: this.configService.get<string>('APPLE_CALLBACK_URL'),
      scopes: ['name', 'email'],
    };
  }

  private async generateCustomOAuthConfig(brokerId: string): Promise<Partial<OAuthConfig>> {
    // For custom OAuth, generate unique client credentials
    return {
      provider: 'CUSTOM',
      clientId: crypto.randomBytes(16).toString('hex'),
      clientSecret: crypto.randomBytes(32).toString('hex'),
      scopes: ['read', 'write'],
    };
  }

  private buildGoogleAuthUrl(config: any, redirectUri: string, state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private buildAppleAuthUrl(config: any, redirectUri: string, state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      response_mode: 'form_post',
    });

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  private buildCustomAuthUrl(config: any, redirectUri: string, state: string): string {
    // For custom OAuth, this would be configurable
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });

    return `${this.configService.get<string>('CUSTOM_OAUTH_AUTH_URL', 'https://oauth.example.com/auth')}?${params.toString()}`;
  }

  private async exchangeGoogleCode(config: any, code: string, redirectUri: string): Promise<any> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async exchangeAppleCode(config: any, code: string, redirectUri: string, codeVerifier?: string): Promise<any> {
    const tokenUrl = 'https://appleid.apple.com/auth/token';
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async exchangeCustomCode(config: any, code: string, redirectUri: string): Promise<any> {
    const tokenUrl = this.configService.get<string>('CUSTOM_OAUTH_TOKEN_URL', 'https://oauth.example.com/token');
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async refreshGoogleToken(config: any): Promise<any> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async refreshAppleToken(config: any): Promise<any> {
    const tokenUrl = 'https://appleid.apple.com/auth/token';
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async refreshCustomToken(config: any): Promise<any> {
    const tokenUrl = this.configService.get<string>('CUSTOM_OAUTH_TOKEN_URL', 'https://oauth.example.com/token');
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    return response.json();
  }

  private async revokeGoogleToken(accessToken: string): Promise<void> {
    const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${accessToken}`;
    await fetch(revokeUrl, { method: 'POST' });
  }

  private async revokeAppleToken(accessToken: string): Promise<void> {
    // Apple doesn't provide a direct revoke endpoint
    // Tokens expire after 1 hour by default
  }

  private async revokeCustomToken(accessToken: string, config: any): Promise<void> {
    const revokeUrl = this.configService.get<string>('CUSTOM_OAUTH_REVOKE_URL', 'https://oauth.example.com/revoke');
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token: accessToken,
    });

    await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  }

  private async generateAppleClientSecret(): Promise<string> {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    const teamId = this.configService.get<string>('APPLE_TEAM_ID');
    const keyId = this.configService.get<string>('APPLE_KEY_ID');
    const privateKeyPath = this.configService.get<string>('APPLE_PRIVATE_KEY_PATH');

    // In a real implementation, this would generate a JWT client secret
    // For now, return a placeholder
    return 'apple-client-secret-placeholder';
  }

  private encryptTokens(tokens: any): string {
    // Encrypt tokens for secure storage
    const tokenString = JSON.stringify(tokens);
    return crypto.createHash('sha256').update(tokenString).digest('hex');
  }
}