import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RewardService } from '../services/reward.service';
import {
  RewardDto,
  RewardClaimDto,
  ClaimRewardDto,
  CreateRewardDto,
  UpdateRewardDto,
} from '../dto/referral.dto';
import { RewardStatus, RewardType } from '../types/referral.types';

@ApiTags('Rewards')
@Controller('rewards')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@ApiBearerAuth()
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user rewards' })
  @ApiResponse({ status: 200, description: 'User rewards retrieved successfully', type: [RewardDto] })
  @ApiQuery({ name: 'status', required: false, enum: RewardStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'type', required: false, enum: RewardType, description: 'Filter by type' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of rewards to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of rewards to skip' })
  async getMyRewards(
    @Request() req,
    @Query('status') status?: RewardStatus,
    @Query('type') type?: RewardType,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<{ rewards: RewardDto[]; total: number }> {
    return this.rewardService.getUserRewards(req.user.id, {
      status,
      type,
      limit,
      offset,
    });
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending (claimable) rewards for current user' })
  @ApiResponse({ status: 200, description: 'Pending rewards retrieved successfully', type: [RewardDto] })
  async getPendingRewards(@Request() req): Promise<RewardDto[]> {
    const result = await this.rewardService.getUserRewards(req.user.id, {
      status: RewardStatus.PENDING,
    });
    return result.rewards;
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available rewards that can be claimed' })
  @ApiResponse({ status: 200, description: 'Available rewards retrieved successfully', type: [RewardDto] })
  async getAvailableRewards(@Request() req): Promise<RewardDto[]> {
    return this.rewardService.getAvailableRewards(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get reward history for current user' })
  @ApiResponse({ status: 200, description: 'Reward history retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of rewards to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of rewards to skip' })
  async getRewardHistory(
    @Request() req,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<{ rewards: RewardDto[]; total: number }> {
    return this.rewardService.getUserRewards(req.user.id, {
      limit,
      offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reward details by ID' })
  @ApiResponse({ status: 200, description: 'Reward details retrieved successfully', type: RewardDto })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  async getRewardById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ): Promise<RewardDto> {
    // Check if user owns this reward or is admin
    const reward = await this.rewardService.getRewardById(id);

    // Additional ownership check would go here
    // For now, return the reward

    return reward;
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a pending reward' })
  @ApiResponse({ status: 200, description: 'Reward claimed successfully', type: RewardClaimDto })
  @ApiResponse({ status: 400, description: 'Reward cannot be claimed' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  async claimReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Request() req,
    @Body() claimData?: ClaimRewardDto,
  ): Promise<RewardClaimDto> {
    return this.rewardService.distributeReward(
      rewardId,
      req.user.id,
      undefined,
      claimData?.metadata,
    );
  }

  @Get('types/available')
  @ApiOperation({ summary: 'Get available reward types' })
  @ApiResponse({ status: 200, description: 'Reward types retrieved successfully' })
  async getAvailableRewardTypes(): Promise<RewardType[]> {
    return this.rewardService.getAvailableRewardTypes();
  }

  @Get('calculate/:tier/:activity')
  @ApiOperation({ summary: 'Calculate reward amount for tier and activity' })
  @ApiResponse({ status: 200, description: 'Reward amount calculated successfully' })
  @ApiParam({ name: 'tier', description: 'Referral tier' })
  @ApiParam({ name: 'activity', description: 'Activity type' })
  @ApiQuery({ name: 'multiplier', required: false, type: Number, description: 'Additional multiplier' })
  async calculateRewardAmount(
    @Param('tier') tier: string,
    @Param('activity') activity: string,
    @Query('multiplier') multiplier = 1.0,
  ): Promise<{ amount: number; tier: string; activity: string; multiplier: number }> {
    const amount = await this.rewardService.calculateRewardAmount(tier, activity, multiplier);
    return { amount, tier, activity, multiplier };
  }

  @Get('tier/multiplier')
  @ApiOperation({ summary: 'Get tier multiplier for current user' })
  @ApiResponse({ status: 200, description: 'Tier multiplier retrieved successfully' })
  async getMyTierMultiplier(@Request() req): Promise<{ multiplier: number; tier: string }> {
    const multiplier = await this.rewardService.getTierMultiplier(req.user.id);

    // Determine tier based on multiplier
    let tier = 'BRONZE';
    if (multiplier >= 5.0) tier = 'DIAMOND';
    else if (multiplier >= 3.0) tier = 'PLATINUM';
    else if (multiplier >= 2.0) tier = 'GOLD';
    else if (multiplier >= 1.5) tier = 'SILVER';

    return { multiplier, tier };
  }

  // Admin endpoints
  @Post('admin/create')
  @ApiOperation({ summary: 'Create a new reward (admin only)' })
  @ApiResponse({ status: 201, description: 'Reward created successfully', type: RewardDto })
  @Roles('ADMIN')
  async createReward(@Body() createData: CreateRewardDto): Promise<RewardDto> {
    return this.rewardService.createReward(createData);
  }

  @Post('admin/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a reward (admin only)' })
  @ApiResponse({ status: 200, description: 'Reward approved successfully', type: RewardDto })
  @Roles('ADMIN')
  async approveReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Request() req,
  ): Promise<RewardDto> {
    return this.rewardService.approveReward(rewardId, req.user.id);
  }

  @Post('admin/:id/expire')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire a reward (admin only)' })
  @ApiResponse({ status: 200, description: 'Reward expired successfully', type: RewardDto })
  @Roles('ADMIN')
  async expireReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Body() body: { reason?: string },
  ): Promise<RewardDto> {
    return this.rewardService.expireReward(rewardId, body.reason);
  }

  @Post('admin/:id/distribute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually distribute reward to user (admin only)' })
  @ApiResponse({ status: 200, description: 'Reward distributed successfully', type: RewardClaimDto })
  @Roles('ADMIN')
  async distributeReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Body() body: { userId: string; referralId?: string; metadata?: any },
  ): Promise<RewardClaimDto> {
    return this.rewardService.distributeReward(
      rewardId,
      body.userId,
      body.referralId,
      body.metadata,
    );
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Get all rewards (admin only)' })
  @ApiResponse({ status: 200, description: 'All rewards retrieved successfully' })
  @Roles('ADMIN')
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'type', required: false, enum: RewardType, description: 'Filter by type' })
  @ApiQuery({ name: 'tier', required: false, description: 'Filter by tier' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of rewards to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of rewards to skip' })
  async getAllRewards(
    @Query('isActive') isActive?: boolean,
    @Query('type') type?: RewardType,
    @Query('tier') tier?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<{ rewards: RewardDto[]; total: number }> {
    return this.rewardService.getAllRewards({
      isActive,
      type,
      tier,
      limit,
      offset,
    });
  }

  @Post('admin/:id/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update reward (admin only)' })
  @ApiResponse({ status: 200, description: 'Reward updated successfully', type: RewardDto })
  @Roles('ADMIN')
  async updateReward(
    @Param('id', ParseUUIDPipe) rewardId: string,
    @Body() updateData: UpdateRewardDto,
  ): Promise<RewardDto> {
    return this.rewardService.updateReward(rewardId, updateData);
  }

  @Post('admin/:id/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete reward (admin only)' })
  @ApiResponse({ status: 200, description: 'Reward deleted successfully' })
  @Roles('ADMIN')
  async deleteReward(@Param('id', ParseUUIDPipe) rewardId: string): Promise<{ success: boolean }> {
    await this.rewardService.deleteReward(rewardId);
    return { success: true };
  }
}