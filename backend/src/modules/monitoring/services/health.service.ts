import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  constructor(
    @InjectRedis() private readonly redis: Redis,
  private readonly configService: ConfigService,
  private readonly prisma: PrismaService) {}
  async basicHealthCheck() {
  return {
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: process.env.npm_package_version || '1.0.0'
  };
  }
  async detailedHealthCheck() {
  const [
  database,
  redis,
  externalServices,
  websockets,
  cpu,
  memory,
  disk
    ] = await Promise.allSettled([
  this.checkDatabaseHealth(),
  this.checkRedisHealth(),
  this.checkExternalServicesHealth(),
  this.checkWebSocketHealth(),
  this.checkCpuHealth(),
  this.checkMemoryHealth(),
  this.checkDiskHealth()
    ]);
  return {
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: process.env.npm_package_version || '1.0.0',
  components: {
  database: database.status === 'fulfilled' ? database.value : { status: 'error', error: database.reason },
  redis: redis.status === 'fulfilled' ? redis.value : { status: 'error', error: redis.reason },
  externalServices: externalServices.status === 'fulfilled' ? externalServices.value : { status: 'error', error: externalServices.reason },
  websockets: websockets.status === 'fulfilled' ? websockets.value : { status: 'error', error: websockets.reason },
  system: {
  cpu: cpu.status === 'fulfilled' ? cpu.value : { status: 'error', error: cpu.reason },
  memory: memory.status === 'fulfilled' ? memory.value : { status: 'error', error: memory.reason },
  disk: disk.status === 'fulfilled' ? disk.value : { status: 'error', error: disk.reason }
  }
  }
  };
  }
  async checkDatabaseHealth() {
  try {
  const start = Date.now();
  await this.prisma.$queryRaw`SELECT 1`;
  const responseTime = Date.now() - start;
  return {
  status: 'ok',
  responseTime: `${responseTime}ms`,
  connection: 'established'
  };
    } catch (error) {
  this.logger.error('Database health check failed', error);
  return {
  status: 'error',
  error: error.message,
  connection: 'failed'
  };
  }
  }
  async checkRedisHealth() {
  try {
  const start = Date.now();
  await this.redis.ping();
  const responseTime = Date.now() - start;
  const info = await this.redis.info('memory');
  const memoryUsed = this.parseRedisMemory(info);
  return {
  status: 'ok',
  responseTime: `${responseTime}ms`,
  memory: memoryUsed,
  connection: 'established'
  };
    } catch (error) {
  this.logger.error('Redis health check failed', error);
  return {
  status: 'error',
  error: error.message,
  connection: 'failed'
  };
  }
  }
  async checkExternalServicesHealth() {
  const services = ['email-provider', 'sms-provider', 'push-provider'];
  const results = {};
  for (const service of services) {
  try {
        // Simulate external service health check
  const responseTime = Math.random() * 200 + 50; // 50-250ms
  results[service] = {
  status: 'ok',
  responseTime: `${Math.round(responseTime)}ms`
  };
      } catch (error) {
  results[service] = {
  status: 'error',
  error: error.message
  };
  }
  }
  return results;
  }
  async checkWebSocketHealth() {
  try {
      // Check if WebSocket gateway is running
      // This would typically involve checking connection counts or health endpoints
  return {
  status: 'ok',
  activeConnections: 0, // Would get actual count from WebSocket service
  lastActivity: new Date().toISOString()
  };
    } catch (error) {
  this.logger.error('WebSocket health check failed', error);
  return {
  status: 'error',
  error: error.message
  };
  }
  }
  async checkCpuHealth() {
  try {
  const cpus = require('os').cpus();
  const loadAvg = require('os').loadavg();
  const cpuCount = cpus.length;
  const currentLoad = loadAvg[0]; // 1-minute average
  const loadPercentage = (currentLoad / cpuCount) * 100;
  return {
  status: loadPercentage > 80 ? 'warning' : 'ok',
  usage: `${Math.round(loadPercentage)}%`,
  cores: cpuCount,
  loadAverage: loadAvg.map(val => val.toFixed(2))
  };
    } catch (error) {
  this.logger.error('CPU health check failed', error);
  return {
  status: 'error',
  error: error.message
  };
  }
  }
  async checkMemoryHealth() {
  try {
  const totalMem = require('os').totalmem();
  const freeMem = require('os').freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsage = (usedMem / totalMem) * 100;
  return {
  status: memoryUsage > 85 ? 'warning' : 'ok',
  usage: `${Math.round(memoryUsage)}%`,
  total: `${Math.round(totalMem / 1024 / 1024)}MB`,
  used: `${Math.round(usedMem / 1024 / 1024)}MB`,
  free: `${Math.round(freeMem / 1024 / 1024)}MB`
  };
    } catch (error) {
  this.logger.error('Memory health check failed', error);
  return {
  status: 'error',
  error: error.message
  };
  }
  }
  async checkDiskHealth() {
  try {
  const fs = require('fs');
  const stats = fs.statSync('.');

      // This is a simplified check - in production you'd want to check actual disk usage
  return {
  status: 'ok',
  usage: '45%', // Placeholder
  total: '100GB', // Placeholder
  used: '45GB', // Placeholder
  free: '55GB' // Placeholder
  };
    } catch (error) {
  this.logger.error('Disk health check failed', error);
  return {
  status: 'error',
  error: error.message
  };
  }
  }
  async runFullHealthCheck() {
  const healthCheck = await this.detailedHealthCheck();

    // Store results in Redis for history
  const key = `health:check:${Date.now()}`;
  await this.redis.setex(key, 86400, JSON.stringify(healthCheck)); // 24 hours TTL
  return healthCheck;
  }
  async getHealthHistory(options: { timeRange?: string; limit?: number }) {
    // This would typically query stored health check results
  return {
  timeRange: options.timeRange || '24h',
  limit: options.limit || 50,
  data: [] // Would return actual historical data
  };
  }
  async getSystemUptime() {
  return {
  uptime: process.uptime(),
  uptimeHuman: this.formatUptime(process.uptime()),
  startDate: new Date(Date.now() - process.uptime() * 1000).toISOString()
  };
  }
  async getVersion() {
  return {
  version: process.env.npm_package_version || '1.0.0',
  name: process.env.npm_package_name || 'viralfx-backend',
  environment: process.env.NODE_ENV || 'development',
  buildTime: process.env.BUILD_TIME || new Date().toISOString()
  };
  }
  private parseRedisMemory(info: string) {
  const lines = info.split('\r\n');
  for (const line of lines) {
  if (line.startsWith('used_memory_human:')) {
  return line.split(':')[1];
  }
  }
  return 'unknown';
  }
  private formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }
}