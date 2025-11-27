import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OAuthService } from '../services/oauth.service';
import { UserRole } from '@prisma/client';
import { Response, Request as ExpressRequest } from 'express';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get(':provider/authorize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Initiate OAuth authorization flow' })
  @ApiParam({ name: 'provider', description: 'OAuth provider (google, apple, custom)' })
  @ApiQuery({ name: 'brokerId', required: true, description: 'Broker ID' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'OAuth callback URL' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authorization URL returned' })
  async authorizeOAuth(
    @Param('provider') provider: string,
    @Query('brokerId') brokerId: string,
    @Query('redirectUri') redirectUri?: string,
  ): Promise<any> {
    const authUrl = await this.oauthService.initiateOAuthFlow(
      brokerId,
      provider,
      redirectUri,
    );

    return {
      success: true,
      data: {
        authUrl,
        provider,
      },
    };
  }

  @Get(':provider/callback')
  @ApiOperation({ summary: 'Handle OAuth callback' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code' })
  @ApiQuery({ name: 'state', required: true, description: 'OAuth state parameter' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth callback handled successfully' })
  @Redirect()
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Res() res?: Response,
  ): Promise<{ url: string }> {
    try {
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      const result = await this.oauthService.handleOAuthCallback(code, state);

      // Redirect to success page with result
      return {
        url: `${process.env.FRONTEND_URL}/oauth/success?provider=${provider}&success=true&brokerId=${result.brokerId}`,
      };
    } catch (err) {
      // Redirect to error page
      return {
        url: `${process.env.FRONTEND_URL}/oauth/error?provider=${provider}&success=false&error=${encodeURIComponent(err.message)}`,
      };
    }
  }

  @Post(':provider/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Refresh OAuth access token' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiQuery({ name: 'brokerId', required: true, description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Token refreshed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No refresh token available' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Param('provider') provider: string,
    @Query('brokerId') brokerId: string,
  ): Promise<any> {
    await this.oauthService.refreshOAuthToken(brokerId, provider);

    return {
      success: true,
      message: 'OAuth token refreshed successfully',
    };
  }

  @Delete(':provider/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revoke OAuth access' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiQuery({ name: 'brokerId', required: true, description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth access revoked successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'OAuth not configured for provider' })
  async revokeAccess(
    @Param('provider') provider: string,
    @Query('brokerId') brokerId: string,
  ): Promise<any> {
    await this.oauthService.revokeOAuthAccess(brokerId, provider);

    return {
      success: true,
      message: 'OAuth access revoked successfully',
    };
  }

  @Get(':provider/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate OAuth configuration for broker' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiQuery({ name: 'brokerId', required: true, description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth configuration generated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Unsupported OAuth provider' })
  async generateOAuthConfig(
    @Param('provider') provider: string,
    @Query('brokerId') brokerId: string,
  ): Promise<any> {
    const config = await this.oauthService.generateOAuthConfig(brokerId, provider);

    return {
      success: true,
      data: config,
    };
  }

  @Post(':provider/validate-scopes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Validate OAuth scopes for broker' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiQuery({ name: 'brokerId', required: true, description: 'Broker ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        requiredScopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required OAuth scopes',
        },
      },
      required: ['requiredScopes'],
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Scopes validation result' })
  async validateScopes(
    @Param('provider') provider: string,
    @Query('brokerId') brokerId: string,
    @Body() body: { requiredScopes: string[] },
  ): Promise<any> {
    const isValid = await this.oauthService.validateOAuthScopes(
      brokerId,
      provider,
      body.requiredScopes,
    );

    return {
      success: true,
      data: {
        isValid,
        requiredScopes: body.requiredScopes,
        provider,
      },
    };
  }

  // OAuth provider-specific endpoints for direct integration testing
  @Get('google/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Test Google OAuth integration' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Google OAuth test completed' })
  async testGoogleOAuth(): Promise<any> {
    return {
      success: true,
      data: {
        provider: 'google',
        status: 'configured',
        clientId: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'not configured',
      },
    };
  }

  @Get('apple/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Test Apple OAuth integration' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Apple OAuth test completed' })
  async testAppleOAuth(): Promise<any> {
    return {
      success: true,
      data: {
        provider: 'apple',
        status: 'configured',
        clientId: process.env.APPLE_CLIENT_ID ? 'configured' : 'missing',
        teamId: process.env.APPLE_TEAM_ID ? 'configured' : 'missing',
        keyId: process.env.APPLE_KEY_ID ? 'configured' : 'missing',
        callbackUrl: process.env.APPLE_CALLBACK_URL || 'not configured',
      },
    };
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get list of supported OAuth providers' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Supported providers returned' })
  async getSupportedProviders(): Promise<any> {
    return {
      success: true,
      data: {
        providers: [
          {
            name: 'google',
            displayName: 'Google',
            description: 'Sign in with Google account',
            icon: 'google-icon-url',
            features: ['email', 'profile', 'drive', 'calendar'],
          },
          {
            name: 'apple',
            displayName: 'Apple',
            description: 'Sign in with Apple ID',
            icon: 'apple-icon-url',
            features: ['name', 'email'],
          },
          {
            name: 'custom',
            displayName: 'Custom OAuth',
            description: 'Configure custom OAuth provider',
            icon: 'custom-icon-url',
            features: ['read', 'write', 'admin'],
          },
        ],
      },
    };
  }

  // Webhook handler for OAuth events (public endpoint)
  @Post('webhook/:provider')
  @ApiOperation({ summary: 'Handle OAuth provider webhooks' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiBody({ description: 'Webhook payload from OAuth provider' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed successfully' })
  @HttpCode(HttpStatus.OK)
  async handleOAuthWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature?: string,
  ): Promise<any> {
    // Handle OAuth provider webhooks (e.g., token revocation, account deletion)
    // For now, return a success response
    return {
      success: true,
      message: 'OAuth webhook received',
      provider,
      timestamp: new Date().toISOString(),
    };
  }

  // Broker self-service OAuth endpoints
  @Get('me/providers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker OAuth configurations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth configurations retrieved successfully' })
  async getMyOAuthProviders(@Request() req): Promise<any> {
    // This would be implemented when broker authentication is added
    return {
      success: true,
      message: 'My OAuth providers endpoint - requires broker authentication',
    };
  }

  @Post('me/:provider/authorize')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate OAuth for current broker' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth initiated successfully' })
  async authorizeMyOAuth(@Request() req, @Param('provider') provider: string): Promise<any> {
    return {
      success: true,
      message: 'Authorize OAuth endpoint - requires broker authentication',
    };
  }

  @Delete('me/:provider/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke OAuth for current broker' })
  @ApiParam({ name: 'provider', description: 'OAuth provider' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OAuth revoked successfully' })
  async revokeMyOAuth(@Request() req, @Param('provider') provider: string): Promise<any> {
    return {
      success: true,
      message: 'Revoke OAuth endpoint - requires broker authentication',
    };
  }
}