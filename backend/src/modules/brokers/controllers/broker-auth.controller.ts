import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BrokerAuthService } from '../services/broker-auth.service';
import { BrokerAuthGuard, BrokerRequest } from '../guards/broker-auth.guard';
import { BrokerLoginDto, BrokerRefreshDto } from '../dto/broker-auth.dto';

@ApiTags('Brokers - Authentication')
@Controller('brokers/auth')
export class BrokerAuthController {
  constructor(
    private readonly brokerAuthService: BrokerAuthService,
  ) {}

  /**
   * Broker Login
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Broker login',
    description: 'Authenticate a broker with email and password'
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            broker: {
              type: 'object',
              description: 'Broker details (without sensitive data)'
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string', description: 'JWT access token (expires in 15m)' },
                refreshToken: { type: 'string', description: 'JWT refresh token (expires in 7d)' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials'
  })
  @ApiResponse({
    status: 403,
    description: 'Account locked or not active'
  })
  async login(@Body() loginDto: BrokerLoginDto) {
    const result = await this.brokerAuthService.login(loginDto);
    return {
      success: true,
      data: result
    };
  }

  /**
   * Refresh Access Token
   */
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get a new access token using a valid refresh token'
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          properties: {
            accessToken: { type: 'string', description: 'New JWT access token' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token'
  })
  async refresh(@Body() refreshDto: BrokerRefreshDto) {
    const result = await this.brokerAuthService.refresh(refreshDto);
    return {
      success: true,
      data: result
    };
  }

  /**
   * Get Broker Profile
   */
  @Get('profile')
  @UseGuards(BrokerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get broker profile',
    description: 'Get the authenticated broker\'s profile information'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token'
  })
  async getProfile(@Request() req: BrokerRequest) {
    const broker = await this.brokerAuthService.getProfile(req.brokerId!);
    return {
      success: true,
      data: broker
    };
  }

  /**
   * Logout
   */
  @Post('logout')
  @UseGuards(BrokerAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout broker',
    description: 'Logout the current broker session'
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful'
  })
  async logout(@Request() req: BrokerRequest) {
    await this.brokerAuthService.logout(req.brokerId!);
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
}
