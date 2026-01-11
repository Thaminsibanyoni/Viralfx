import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// TypeORM entities removed - using Prisma instead
// import { BacktestingStrategy } from "../../../database/entities/backtesting-strategy.entity";
// import { StrategyCategory, StrategyParameter, StrategyRule } from "../../../database/entities/backtesting-strategy.entity";
import { BacktestStrategy } from '../interfaces/backtesting.interface';

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    // TypeORM repository removed - using Prisma instead
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private configService: ConfigService) {}

  /**
   * Create a new strategy
   */
  async createStrategy(createDto: {
    name: string;
    description?: string;
    category: StrategyCategory;
    parameters: StrategyParameter[];
    rules: StrategyRule[];
    isPublic?: boolean;
    userId?: string;
  }): Promise<BacktestStrategy> {
    try {
      // Validate strategy before saving
      this.validateStrategyParameters(createDto.parameters);
      this.validateStrategyRules(createDto.rules);

      const strategyData = {
        id: uuidv4(),
        name: createDto.name,
        description: createDto.description,
        category: createDto.category,
        parameters: createDto.parameters as any,
        rules: createDto.rules as any,
        isPublic: createDto.isPublic || false,
        userId: createDto.userId,
        version: '1.0.0',
        isActive: true,
        metadata: {
          createdAt: new Date(),
          source: 'user_created'
        }
      };

      const savedStrategy = await this.prisma.backtestingStrategy.create({
        data: strategyData
      });

      // Clear cache
      await this.invalidateStrategyCache(savedStrategy.id);

      // Transform to BacktestStrategy interface
      return this.mapToBacktestStrategy(savedStrategy);
    } catch (error) {
      this.logger.error('Failed to create strategy:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to create strategy');
    }
  }

  /**
   * Update an existing strategy
   */
  async updateStrategy(
    id: string,
    updateDto: {
      name?: string;
      description?: string;
      category?: StrategyCategory;
      parameters?: StrategyParameter[];
      rules?: StrategyRule[];
      isPublic?: boolean;
      userId?: string; // For authorization
    }): Promise<BacktestStrategy> {
    try {
      const strategy = await this.prisma.backtestingStrategy.findFirst({ where: { id } });
      if (!strategy) {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      // Check authorization if userId provided
      if (updateDto.userId && strategy.userId !== updateDto.userId) {
        throw new BadRequestException('You can only update your own strategies');
      }

      // Validate updates
      if (updateDto.parameters) {
        this.validateStrategyParameters(updateDto.parameters);
      }
      if (updateDto.rules) {
        this.validateStrategyRules(updateDto.rules);
      }

      // Prepare update data
      const updateData: any = {
        ...updateDto,
        version: this.incrementVersion(strategy.version),
        updatedAt: new Date(),
        metadata: {
          ...(strategy.metadata as any),
          lastModified: new Date(),
          modifiedBy: updateDto.userId
        }
      };

      // Update strategy
      const updatedStrategy = await this.prisma.backtestingStrategy.update({
        where: { id },
        data: updateData
      });

      // Clear cache
      await this.invalidateStrategyCache(id);

      return this.mapToBacktestStrategy(updatedStrategy);
    } catch (error) {
      this.logger.error('Failed to update strategy:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to update strategy');
    }
  }

  /**
   * Soft delete a strategy
   */
  async deleteStrategy(id: string, userId?: string): Promise<void> {
    try {
      const strategy = await this.prisma.backtestingStrategy.findFirst({ where: { id } });
      if (!strategy) {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      // Check authorization if userId provided
      if (userId && strategy.userId !== userId) {
        throw new BadRequestException('You can only delete your own strategies');
      }

      // Soft delete by setting isActive to false
      await this.prisma.backtestingStrategy.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
          metadata: {
            ...(strategy.metadata as any),
            deletedAt: new Date(),
            deletedBy: userId
          }
        }
      });

      // Clear cache
      await this.invalidateStrategyCache(id);

      this.logger.log(`Strategy soft deleted: ${id}`);
    } catch (error) {
      this.logger.error('Failed to delete strategy:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to delete strategy');
    }
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(id: string): Promise<BacktestStrategy> {
    try {
      const cacheKey = `strategy:${id}`;
      const cachedStrategy = await this.redis.get(cacheKey);
      if (cachedStrategy) {
        return JSON.parse(cachedStrategy);
      }

      const strategy = await this.prisma.backtestingStrategy.findFirst({
        where: { id, isActive: true }
      });

      if (!strategy) {
        // Try to get system strategy
        const systemStrategy = await this.getSystemStrategy(id);
        if (systemStrategy) {
          // Cache system strategies for longer
          await this.redis.setex(cacheKey, 7200, JSON.stringify(systemStrategy)); // 2 hours
          return systemStrategy;
        }
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      const backtestStrategy = this.mapToBacktestStrategy(strategy);

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(backtestStrategy));

      return backtestStrategy;
    } catch (error) {
      this.logger.error('Failed to get strategy:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to get strategy');
    }
  }

  /**
   * List strategies with filters
   */
  async listStrategies(filters: {
    category?: StrategyCategory;
    userId?: string;
    isPublic?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{
    strategies: BacktestStrategy[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const {
        category,
        userId,
        isPublic,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = filters;

      // Build where clause for Prisma
      const where: any = {
        isActive: true
      };

      if (category) {
        where.category = category;
      }

      if (userId) {
        where.userId = userId;
      }

      if (isPublic !== undefined) {
        where.isPublic = isPublic;
      }

      // Get total count
      const total = await this.prisma.backtestingStrategy.count({ where });

      // Build orderBy clause
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder.toLowerCase();

      // Get paginated results
      const strategies = await this.prisma.backtestingStrategy.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      });

      const backtestStrategies = strategies.map(strategy =>
        this.mapToBacktestStrategy(strategy)
      );

      return {
        strategies: backtestStrategies,
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error('Failed to list strategies:', error);
      throw new Error('Failed to list strategies');
    }
  }

  /**
   * Clone a strategy for user customization
   */
  async cloneStrategy(id: string, userId: string): Promise<BacktestStrategy> {
    try {
      const originalStrategy = await this.prisma.backtestingStrategy.findFirst({
        where: { id, isActive: true }
      });

      if (!originalStrategy) {
        throw new NotFoundException(`Strategy not found: ${id}`);
      }

      // Check if user can clone this strategy
      if (!originalStrategy.isPublic && originalStrategy.userId !== userId) {
        throw new BadRequestException('You can only clone public strategies or your own strategies');
      }

      const clonedStrategyData = {
        id: uuidv4(),
        name: `${originalStrategy.name} (Clone)`,
        description: originalStrategy.description,
        category: originalStrategy.category,
        parameters: originalStrategy.parameters,
        rules: originalStrategy.rules,
        isPublic: false,
        userId,
        version: '1.0.0',
        isActive: true,
        metadata: {
          ...(originalStrategy.metadata as any),
          clonedFrom: originalStrategy.id,
          clonedAt: new Date(),
          source: 'user_cloned'
        }
      };

      const savedStrategy = await this.prisma.backtestingStrategy.create({
        data: clonedStrategyData
      });

      this.logger.log(`Strategy cloned: ${originalStrategy.id} -> ${savedStrategy.id}`);

      return this.mapToBacktestStrategy(savedStrategy);
    } catch (error) {
      this.logger.error('Failed to clone strategy:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to clone strategy');
    }
  }

  /**
   * Validate strategy parameters and rules
   */
  validateStrategy(strategy: {
    parameters?: StrategyParameter[];
    rules?: StrategyRule[];
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (strategy.parameters) {
        this.validateStrategyParameters(strategy.parameters);
      }

      if (strategy.rules) {
        this.validateStrategyRules(strategy.rules);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        errors.push(error.message);
      } else {
        errors.push('Unknown validation error');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get system (built-in) strategies
   */
  async getSystemStrategies(): Promise<BacktestStrategy[]> {
    const systemStrategyIds = ['trend_momentum', 'sentiment_reversal'];
    const strategies: BacktestStrategy[] = [];

    for (const id of systemStrategyIds) {
      try {
        const strategy = await this.getSystemStrategy(id);
        if (strategy) {
          strategies.push(strategy);
        }
      } catch (error) {
        this.logger.warn(`Failed to load system strategy: ${id}`, error);
      }
    }

    return strategies;
  }

  /**
   * Seed default strategies on module init
   */
  async seedDefaultStrategies(): Promise<void> {
    try {
      const existingCount = await this.prisma.backtestingStrategy.count({
        where: { isPublic: true, userId: null }
      });

      if (existingCount > 0) {
        this.logger.log('System strategies already exist, skipping seeding');
        return;
      }

      const systemStrategies = await this.getSystemStrategies();

      for (const strategyData of systemStrategies) {
        await this.prisma.backtestingStrategy.create({
          data: {
            id: strategyData.id,
            name: strategyData.name,
            description: strategyData.description,
            category: strategyData.category,
            parameters: strategyData.parameters as any,
            rules: strategyData.rules as any,
            isPublic: true,
            userId: null,
            version: strategyData.version,
            isActive: true,
            metadata: {
              ...strategyData.metadata,
              source: 'system_seeded',
              seededAt: new Date()
            }
          }
        });
      }

      this.logger.log(`Seeded ${systemStrategies.length} system strategies`);
    } catch (error) {
      this.logger.error('Failed to seed default strategies:', error);
    }
  }

  // Helper methods

  private mapToBacktestStrategy(strategy: BacktestingStrategy): BacktestStrategy {
    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      category: strategy.category,
      parameters: strategy.parameters,
      rules: strategy.rules,
      isActive: strategy.isActive,
      isPublic: strategy.isPublic,
      userId: strategy.userId,
      version: strategy.version,
      metadata: strategy.metadata,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt
    };
  }

  private async getSystemStrategy(strategyId: string): Promise<BacktestStrategy | null> {
    const systemStrategies: Record<string, BacktestStrategy> = {
      'trend_momentum': {
        id: 'trend_momentum',
        name: 'Trend Momentum Strategy',
        description: 'Buy when momentum exceeds threshold, sell when momentum drops',
        category: StrategyCategory.TREND_MOMENTUM,
        parameters: [
          {
            name: 'minViralityScore',
            type: 'number',
            defaultValue: 75,
            min: 0,
            max: 100,
            step: 5,
            description: 'Minimum virality score to trigger buy signal'
          },
          {
            name: 'sentimentThreshold',
            type: 'number',
            defaultValue: 0.5,
            min: -1,
            max: 1,
            step: 0.1,
            description: 'Sentiment threshold for buy signal'
          },
          {
            name: 'holdPeriod',
            type: 'number',
            defaultValue: 24,
            min: 1,
            max: 168,
            step: 1,
            description: 'Maximum hold period in hours'
          },
          {
            name: 'stopLoss',
            type: 'number',
            defaultValue: 0.1,
            min: 0,
            max: 0.5,
            step: 0.01,
            description: 'Stop loss percentage'
          },
          {
            name: 'takeProfit',
            type: 'number',
            defaultValue: 0.2,
            min: 0,
            max: 1,
            step: 0.01,
            description: 'Take profit percentage'
          },
        ],
        rules: [
          {
            type: 'BUY',
            condition: 'AND',
            criteria: [
              { field: 'momentum_score', operator: '>', value: '{{minViralityScore}}' },
              { field: 'sentiment_index', operator: '>', value: '{{sentimentThreshold}}' },
              { field: 'volume_24h', operator: '>', value: 10000 },
            ]
          },
          {
            type: 'SELL',
            condition: 'OR',
            criteria: [
              { field: 'momentum_score', operator: '<', value: '{{minViralityScore}} * 0.8' },
              { field: 'price_change_percent', operator: '<', value: '-{{stopLoss}}' },
              { field: 'price_change_percent', operator: '>', value: '{{takeProfit}}' },
              { field: 'hold_duration', operator: '>', value: '{{holdPeriod}}' },
            ]
          },
        ],
        isActive: true,
        isPublic: true,
        version: '1.0.0',
        metadata: { source: 'system_builtin' },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'sentiment_reversal': {
        id: 'sentiment_reversal',
        name: 'Sentiment Reversal Strategy',
        description: 'Trade based on sentiment reversals',
        category: StrategyCategory.SENTIMENT_REVERSAL,
        parameters: [
          {
            name: 'sentimentOversold',
            type: 'number',
            defaultValue: -0.7,
            min: -1,
            max: 0,
            step: 0.1,
            description: 'Oversold sentiment threshold'
          },
          {
            name: 'sentimentOverbought',
            type: 'number',
            defaultValue: 0.7,
            min: 0,
            max: 1,
            step: 0.1,
            description: 'Overbought sentiment threshold'
          },
          {
            name: 'confirmationPeriod',
            type: 'number',
            defaultValue: 6,
            min: 1,
            max: 24,
            step: 1,
            description: 'Confirmation period in hours'
          },
        ],
        rules: [
          {
            type: 'BUY',
            condition: 'AND',
            criteria: [
              { field: 'sentiment_index', operator: '<', value: '{{sentimentOversold}}' },
              { field: 'sentiment_trend', operator: '>', value: 0 },
            ]
          },
          {
            type: 'SELL',
            condition: 'OR',
            criteria: [
              { field: 'sentiment_index', operator: '>', value: '{{sentimentOverbought}}' },
              { field: 'sentiment_trend', operator: '<', value: 0 },
            ]
          },
        ],
        isActive: true,
        isPublic: true,
        version: '1.0.0',
        metadata: { source: 'system_builtin' },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return systemStrategies[strategyId] || null;
  }

  private validateStrategyParameters(parameters: StrategyParameter[]): void {
    const errors: string[] = [];

    for (const param of parameters) {
      if (!param.name || param.name.trim() === '') {
        errors.push('Parameter name is required');
      }

      if (!['number', 'string', 'boolean'].includes(param.type)) {
        errors.push(`Invalid parameter type: ${param.type}`);
      }

      if (param.defaultValue === undefined) {
        errors.push(`Parameter ${param.name} must have a default value`);
      }

      if (param.type === 'number') {
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          errors.push(`Parameter ${param.name}: min cannot be greater than max`);
        }

        if (param.min !== undefined && param.defaultValue < param.min) {
          errors.push(`Parameter ${param.name}: default value cannot be less than min`);
        }

        if (param.max !== undefined && param.defaultValue > param.max) {
          errors.push(`Parameter ${param.name}: default value cannot be greater than max`);
        }
      }
    }

    // Check for duplicate parameter names
    const names = parameters.map(p => p.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      errors.push('Parameter names must be unique');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Invalid parameters: ${errors.join(', ')}`);
    }
  }

  private validateStrategyRules(rules: StrategyRule[]): void {
    const errors: string[] = [];

    for (const rule of rules) {
      if (!['BUY', 'SELL', 'EXIT'].includes(rule.type)) {
        errors.push(`Invalid rule type: ${rule.type}`);
      }

      if (!['AND', 'OR'].includes(rule.condition)) {
        errors.push(`Invalid rule condition: ${rule.condition}`);
      }

      if (!Array.isArray(rule.criteria) || rule.criteria.length === 0) {
        errors.push('Rules must have at least one criterion');
      }

      for (const criterion of rule.criteria) {
        if (!criterion.field || criterion.field.trim() === '') {
          errors.push('Criterion field is required');
        }

        if (!['>', '<', '>=', '<=', '==', '!=', 'contains'].includes(criterion.operator)) {
          errors.push(`Invalid criterion operator: ${criterion.operator}`);
        }

        if (criterion.value === undefined || criterion.value === null) {
          errors.push('Criterion value is required');
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Invalid rules: ${errors.join(', ')}`);
    }
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 3) {
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    return version;
  }

  private async invalidateStrategyCache(strategyId: string): Promise<void> {
    const cacheKey = `strategy:${strategyId}`;
    await this.redis.del(cacheKey);
  }
}
