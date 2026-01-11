import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database?: DatabaseHealth;
    redis?: RedisHealth;
    memory?: MemoryHealth;
    modules?: ModuleHealth;
  };
}

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  connection: 'connected' | 'disconnected';
  responseTime: number;
  error?: string;
}

export interface RedisHealth {
  status: 'healthy' | 'unhealthy';
  connection: 'connected' | 'disconnected';
  responseTime: number;
  error?: string;
}

export interface MemoryHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
}

export interface ModuleHealth {
  [moduleName: string]: {
    status: 'healthy' | 'unhealthy';
    message?: string;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    const checks: any = {};

    // Run health checks in parallel
    const [dbHealth, redisHealth, memoryHealth] = await Promise.all([
      this.getDatabaseHealth().catch(err => ({
        status: 'unhealthy' as const,
        connection: 'disconnected' as const,
        responseTime: -1,
        error: err.message,
      })),
      this.getRedisHealth().catch(err => ({
        status: 'unhealthy' as const,
        connection: 'disconnected' as const,
        responseTime: -1,
        error: err.message,
      })),
      this.getMemoryHealth(),
    ]);

    checks.database = dbHealth;
    checks.redis = redisHealth;
    checks.memory = memoryHealth;

    // Determine overall status
    const allHealthy = Object.values(checks).every(
      check => check.status === 'healthy'
    );
    const anyUnhealthy = Object.values(checks).some(
      check => check.status === 'unhealthy'
    );

    const status: 'healthy' | 'unhealthy' | 'degraded' = allHealthy
      ? 'healthy'
      : anyUnhealthy
      ? 'unhealthy'
      : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }

  @Get('database')
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        connection: 'connected',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connection: 'disconnected',
        responseTime: -1,
        error: error.message,
      };
    }
  }

  @Get('redis')
  async getRedisHealth(): Promise<RedisHealth> {
    const startTime = Date.now();

    try {
      await this.redisService.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        connection: 'connected',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connection: 'disconnected',
        responseTime: -1,
        error: error.message,
      };
    }
  }

  @Get('memory')
  getMemoryHealth(): MemoryHealth {
    const used = process.memoryUsage();
    const total = process.memoryUsage().heapTotal;
    const percentage = (used.heapUsed / used.heapTotal) * 100;

    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (percentage > 90) {
      status = 'unhealthy';
    } else if (percentage > 75) {
      status = 'degraded';
    }

    return {
      status,
      used: used.rss,
      total: used.heapTotal,
      percentage,
      heapUsed: used.heapUsed,
      heapTotal: used.heapTotal,
    };
  }

  @Get('modules')
  async getModulesHealth(): Promise<ModuleHealth> {
    const modules = this.config.get('ENABLED_MODULES', '').split(',');

    const moduleHealth: ModuleHealth = {};

    for (const moduleName of modules) {
      moduleHealth[moduleName] = {
        status: 'healthy',
        message: 'Module is operational',
      };
    }

    return moduleHealth;
  }

  @Get('live')
  async liveness(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; checks: any }> {
    const checks = await Promise.all([
      this.getDatabaseHealth().catch(() => null),
      this.getRedisHealth().catch(() => null),
    ]);

    const ready = checks.every(check => check && check.status === 'healthy');

    return {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        database: checks[0],
        redis: checks[1],
      },
    };
  }
}
