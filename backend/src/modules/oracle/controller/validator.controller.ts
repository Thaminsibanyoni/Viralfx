import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
// ValidatorNodeService would be imported here if needed for direct validator operations
import { ConsensusService } from '../services/consensus.service';

@ApiTags('validators')
@Controller('api/validators')
export class ValidatorController {
  constructor(
    private readonly consensusService: ConsensusService,
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Get validator health status',
    description: 'Returns the health status of all validator nodes in the network.'
  })
  @ApiResponse({
    status: 200,
    description: 'Validator health status'
  })
  async getValidatorHealth(): Promise<any> {
    return await this.consensusService.getValidatorHealth();
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get validator performance metrics',
    description: 'Returns detailed performance metrics for all validator nodes.'
  })
  @ApiResponse({
    status: 200,
    description: 'Validator performance metrics'
  })
  async getValidatorMetrics(): Promise<any> {
    try {
      // Get basic metrics from consensus service
      const health = await this.consensusService.getValidatorHealth();

      return {
        status: 'success',
        data: {
          ...health,
          networkType: 'docker-simulated',
          uptime: process.uptime(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get validator metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}