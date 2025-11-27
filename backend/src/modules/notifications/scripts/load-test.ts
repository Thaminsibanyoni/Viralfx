#!/usr/bin/env ts-node

/**
 * Notification Processors Load Test Script
 *
 * This script performs load testing on the notification processors by:
 * 1. Generating high volumes of test jobs
 * 2. Monitoring queue performance
 * 3. Measuring processing times
 * 4. Identifying bottlenecks
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';

interface LoadTestConfig {
  emailJobs: number;
  pushJobs: number;
  smsJobs: number;
  inAppJobs: number;
  concurrentBatches: number;
  batchDelay: number;
  monitoringInterval: number;
}

interface LoadTestMetrics {
  timestamp: number;
  emailQueue: QueueMetrics;
  pushQueue: QueueMetrics;
  smsQueue: QueueMetrics;
  inAppQueue: QueueMetrics;
  systemMetrics: SystemMetrics;
}

interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  rate: number; // jobs per second
}

interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
}

class NotificationLoadTester {
  private emailQueue: Queue;
  private pushQueue: Queue;
  private smsQueue: Queue;
  private inAppQueue: Queue;
  private configService: ConfigService;
  private metrics: LoadTestMetrics[] = [];
  private startTime: number;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    emailQueue: Queue,
    pushQueue: Queue,
    smsQueue: Queue,
    inAppQueue: Queue,
    configService: ConfigService,
  ) {
    this.emailQueue = emailQueue;
    this.pushQueue = pushQueue;
    this.smsQueue = smsQueue;
    this.inAppQueue = inAppQueue;
    this.configService = configService;
  }

  async runLoadTest(config: LoadTestConfig): Promise<void> {
    console.log('🚀 Starting Notification Load Test');
    console.log('==================================\n');
    console.log(`Configuration:`);
    console.log(`  Email Jobs: ${config.emailJobs}`);
    console.log(`  Push Jobs: ${config.pushJobs}`);
    console.log(`  SMS Jobs: ${config.smsJobs}`);
    console.log(`  In-App Jobs: ${config.inAppJobs}`);
    console.log(`  Concurrent Batches: ${config.concurrentBatches}`);
    console.log(`  Batch Delay: ${config.batchDelay}ms`);
    console.log(`  Monitoring Interval: ${config.monitoringInterval}ms\n`);

    this.startTime = Date.now();

    try {
      // Clean queues
      await this.cleanQueues();

      // Start monitoring
      this.startMonitoring(config.monitoringInterval);

      // Load test phases
      console.log('📊 Phase 1: Initial Load Test');
      await this.runPhase1(config);

      console.log('\n📈 Phase 2: Stress Test');
      await this.runPhase2(config);

      console.log('\n⚡ Phase 3: Burst Test');
      await this.runPhase3(config);

      console.log('\n🔄 Phase 4: Recovery Test');
      await this.runPhase4(config);

      // Stop monitoring
      this.stopMonitoring();

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Load test failed:', error);
      throw error;
    }
  }

  private async cleanQueues(): Promise<void> {
    console.log('🧹 Cleaning queues...');

    const queues = [this.emailQueue, this.pushQueue, this.smsQueue, this.inAppQueue];

    for (const queue of queues) {
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      await queue.clean(0, 'delayed');
    }

    console.log('✅ Queues cleaned\n');
  }

  private startMonitoring(interval: number): void {
    console.log('📡 Starting monitoring...');

    this.monitoringInterval = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);
      this.displayMetrics(metrics);
    }, interval);

    console.log('✅ Monitoring started\n');
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async collectMetrics(): Promise<LoadTestMetrics> {
    const [
      emailCounts,
      pushCounts,
      smsCounts,
      inAppCounts,
    ] = await Promise.all([
      this.getQueueCounts(this.emailQueue),
      this.getQueueCounts(this.pushQueue),
      this.getQueueCounts(this.smsQueue),
      this.getQueueCounts(this.inAppQueue),
    ]);

    const emailPaused = await this.emailQueue.isPaused();
    const pushPaused = await this.pushQueue.isPaused();
    const smsPaused = await this.smsQueue.isPaused();
    const inAppPaused = await this.inAppQueue.isPaused();

    const systemMetrics: SystemMetrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
    };

    return {
      timestamp: Date.now() - this.startTime,
      emailQueue: {
        ...emailCounts,
        paused: emailPaused,
        rate: this.calculateRate('email'),
      },
      pushQueue: {
        ...pushCounts,
        paused: pushPaused,
        rate: this.calculateRate('push'),
      },
      smsQueue: {
        ...smsCounts,
        paused: smsPaused,
        rate: this.calculateRate('sms'),
      },
      inAppQueue: {
        ...inAppCounts,
        paused: inAppPaused,
        rate: this.calculateRate('in-app'),
      },
      systemMetrics,
    };
  }

  private async getQueueCounts(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return await queue.getJobCounts();
  }

  private calculateRate(queueType: string): number {
    if (this.metrics.length < 2) return 0;

    const recent = this.metrics.slice(-2);
    const [prev, curr] = recent;

    let completedDiff = 0;

    switch (queueType) {
      case 'email':
        completedDiff = curr.emailQueue.completed - prev.emailQueue.completed;
        break;
      case 'push':
        completedDiff = curr.pushQueue.completed - prev.pushQueue.completed;
        break;
      case 'sms':
        completedDiff = curr.smsQueue.completed - prev.smsQueue.completed;
        break;
      case 'in-app':
        completedDiff = curr.inAppQueue.completed - prev.inAppQueue.completed;
        break;
    }

    const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
    return timeDiff > 0 ? completedDiff / timeDiff : 0;
  }

  private displayMetrics(metrics: LoadTestMetrics): void {
    const elapsed = (metrics.timestamp / 1000).toFixed(1);
    const memoryMB = (metrics.systemMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1);

    console.log(
      `\r⏱️ ${elapsed}s | ` +
      `Email: ${metrics.emailQueue.waiting}W/${metrics.emailQueue.active}A/${metrics.emailQueue.completed}C ` +
      `(${metrics.emailQueue.rate.toFixed(1)}/s) | ` +
      `Push: ${metrics.pushQueue.waiting}W/${metrics.pushQueue.active}A/${metrics.pushQueue.completed}C ` +
      `(${metrics.pushQueue.rate.toFixed(1)}/s) | ` +
      `Memory: ${memoryMB}MB`
    );
  }

  private async runPhase1(config: LoadTestConfig): Promise<void> {
    console.log('Adding steady load...');

    const promises = [];

    // Email jobs
    for (let i = 0; i < config.emailJobs; i++) {
      promises.push(
        this.emailQueue.add('send-email', {
          to: `loadtest${i}@example.com`,
          subject: `Load Test Email ${i}`,
          template: 'user-welcome',
          data: { name: `Load Test User ${i}` },
          priority: 'MEDIUM',
          userId: `load-user-${i}`,
        })
      );
    }

    // Push jobs
    for (let i = 0; i < config.pushJobs; i++) {
      promises.push(
        this.pushQueue.add('send-push', {
          userId: `load-user-${i}`,
          title: `Load Test Push ${i}`,
          body: `This is load test push notification ${i}`,
          data: { testId: i },
          priority: 'MEDIUM',
        })
      );
    }

    // SMS jobs (with rate limiting)
    for (let i = 0; i < config.smsJobs; i++) {
      promises.push(
        this.smsQueue.add('send-sms', {
          to: `+2712345678${String(i).padStart(2, '0')}`,
          message: `Load test SMS ${i}`,
          priority: 'LOW',
          userId: `load-user-${i}`,
        })
      );
    }

    // In-App jobs
    for (let i = 0; i < config.inAppJobs; i++) {
      promises.push(
        this.inAppQueue.add('send-in-app', {
          userId: `load-user-${i}`,
          title: `Load Test In-App ${i}`,
          message: `This is load test in-app notification ${i}`,
          data: { testId: i },
          type: 'SYSTEM',
          category: 'INFO',
          priority: 'MEDIUM',
        })
      );
    }

    await Promise.all(promises);
    console.log(`✅ Added ${config.emailJobs + config.pushJobs + config.smsJobs + config.inAppJobs} jobs`);

    // Wait for initial processing
    await this.waitForCompletion(30000);
  }

  private async runPhase2(config: LoadTestConfig): Promise<void> {
    console.log('Adding stress load (2x)...');

    const promises = [];
    const multiplier = 2;

    // Double the load for stress test
    for (let i = 0; i < config.emailJobs * multiplier; i++) {
      promises.push(
        this.emailQueue.add('send-email', {
          to: `stresstest${i}@example.com`,
          subject: `Stress Test Email ${i}`,
          message: `High volume stress test email ${i}`,
          priority: i % 3 === 0 ? 'HIGH' : 'MEDIUM',
        })
      );
    }

    for (let i = 0; i < config.pushJobs * multiplier; i++) {
      promises.push(
        this.pushQueue.add('send-push', {
          userId: `stress-user-${i}`,
          title: `Stress Test Push ${i}`,
          body: `High volume stress test push ${i}`,
          data: { stressTest: true, testId: i },
          priority: 'HIGH',
        })
      );
    }

    await Promise.all(promises);
    console.log(`✅ Added ${(config.emailJobs + config.pushJobs) * multiplier} stress jobs`);

    await this.waitForCompletion(60000);
  }

  private async runPhase3(config: LoadTestConfig): Promise<void> {
    console.log('Adding burst load...');

    // Add jobs in rapid succession to test burst handling
    const burstSize = 100;
    const promises = [];

    for (let i = 0; i < burstSize; i++) {
      promises.push(
        Promise.all([
          this.emailQueue.add('send-email', {
            to: `burst${i}@example.com`,
            subject: `Burst Email ${i}`,
            message: `Burst test email ${i}`,
            priority: 'CRITICAL',
          }),
          this.pushQueue.add('send-push', {
            userId: `burst-user-${i}`,
            title: `Burst Push ${i}`,
            body: `Burst test push ${i}`,
            priority: 'CRITICAL',
          }),
          this.inAppQueue.add('send-in-app', {
            userId: `burst-user-${i}`,
            title: `Burst In-App ${i}`,
            message: `Burst test in-app ${i}`,
            priority: 'CRITICAL',
          }),
        ])
      );
    }

    await Promise.all(promises);
    console.log(`✅ Added ${burstSize * 3} burst jobs`);

    await this.waitForCompletion(45000);
  }

  private async runPhase4(config: LoadTestConfig): Promise<void> {
    console.log('Testing recovery after load...');

    // Pause all queues
    await Promise.all([
      this.emailQueue.pause(),
      this.pushQueue.pause(),
      this.smsQueue.pause(),
      this.inAppQueue.pause(),
    ]);

    console.log('⏸️ Queues paused');

    // Add jobs while paused
    for (let i = 0; i < 50; i++) {
      await this.emailQueue.add('send-email', {
        to: `recovery${i}@example.com`,
        subject: `Recovery Test Email ${i}`,
        message: `Recovery test email ${i}`,
      });
    }

    console.log('📦 Added jobs while paused');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Resume queues
    await Promise.all([
      this.emailQueue.resume(),
      this.pushQueue.resume(),
      this.smsQueue.resume(),
      this.inAppQueue.resume(),
    ]);

    console.log('▶️ Queues resumed - testing recovery');

    await this.waitForCompletion(30000);
  }

  private async waitForCompletion(timeout: number): Promise<void> {
    console.log(`⏳ Waiting for completion (${timeout}ms timeout)...`);

    const startTime = Date.now();
    let previousCompleted = 0;
    let stableCount = 0;

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const [
        emailCounts,
        pushCounts,
        smsCounts,
        inAppCounts,
      ] = await Promise.all([
        this.emailQueue.getJobCounts(),
        this.pushQueue.getJobCounts(),
        this.smsQueue.getJobCounts(),
        this.inAppQueue.getJobCounts(),
      ]);

      const totalCompleted = emailCounts.completed + pushCounts.completed +
                           smsCounts.completed + inAppCounts.completed;
      const totalActive = emailCounts.active + pushCounts.active +
                         smsCounts.active + inAppCounts.active;
      const totalWaiting = emailCounts.waiting + pushCounts.waiting +
                          smsCounts.waiting + inAppCounts.waiting;

      if (totalCompleted === previousCompleted && totalActive === 0) {
        stableCount++;
        if (stableCount >= 3) {
          console.log('✅ All jobs completed');
          break;
        }
      } else {
        stableCount = 0;
      }

      previousCompleted = totalCompleted;

      console.log(
        `  📊 Status: ${totalWaiting} waiting, ${totalActive} active, ${totalCompleted} completed`
      );
    }
  }

  private generateReport(): void {
    console.log('\n📊 Load Test Report');
    console.log('====================\n');

    if (this.metrics.length === 0) {
      console.log('No metrics collected');
      return;
    }

    const totalTime = this.metrics[this.metrics.length - 1].timestamp / 1000;

    // Calculate averages and peaks
    const emailMetrics = this.calculateQueueMetrics('emailQueue');
    const pushMetrics = this.calculateQueueMetrics('pushQueue');
    const smsMetrics = this.calculateQueueMetrics('smsQueue');
    const inAppMetrics = this.calculateQueueMetrics('inAppQueue');

    // System metrics
    const systemMetrics = this.calculateSystemMetrics();

    console.log('Test Duration:');
    console.log(`  Total Time: ${totalTime.toFixed(1)}s`);
    console.log(`  Data Points: ${this.metrics.length}\n`);

    console.log('Queue Performance:');
    this.displayQueueReport('Email', emailMetrics);
    this.displayQueueReport('Push', pushMetrics);
    this.displayQueueReport('SMS', smsMetrics);
    this.displayQueueReport('In-App', inAppMetrics);

    console.log('System Resources:');
    console.log(`  Peak Memory: ${systemMetrics.peakMemory.toFixed(1)}MB`);
    console.log(`  Average Memory: ${systemMetrics.avgMemory.toFixed(1)}MB`);
    console.log(`  Final Memory: ${systemMetrics.finalMemory.toFixed(1)}MB`);
    console.log(`  Memory Growth: ${(systemMetrics.finalMemory - systemMetrics.initialMemory).toFixed(1)}MB\n`);

    // Performance analysis
    this.analyzePerformance(emailMetrics, pushMetrics, smsMetrics, inAppMetrics, systemMetrics);

    console.log('✅ Load test completed successfully!');
  }

  private calculateQueueMetrics(queueKey: string) {
    const completed = this.metrics.map(m => m[queueKey].completed);
    const failed = this.metrics.map(m => m[queueKey].failed);
    const rates = this.metrics.map(m => m[queueKey].rate);

    return {
      totalCompleted: completed[completed.length - 1] || 0,
      totalFailed: failed[failed.length - 1] || 0,
      peakRate: Math.max(...rates, 0),
      averageRate: rates.reduce((a, b) => a + b, 0) / rates.length,
      successRate: this.calculateSuccessRate(completed[completed.length - 1], failed[failed.length - 1]),
    };
  }

  private calculateSystemMetrics() {
    const memoryUsage = this.metrics.map(m => m.systemMetrics.memoryUsage.heapUsed / 1024 / 1024);

    return {
      initialMemory: memoryUsage[0] || 0,
      peakMemory: Math.max(...memoryUsage, 0),
      finalMemory: memoryUsage[memoryUsage.length - 1] || 0,
      avgMemory: memoryUsage.reduce((a, b) => a + b, 0) / memoryUsage.length,
    };
  }

  private displayQueueReport(name: string, metrics: any): void {
    console.log(`  ${name}:`);
    console.log(`    Completed: ${metrics.totalCompleted}`);
    console.log(`    Failed: ${metrics.totalFailed}`);
    console.log(`    Success Rate: ${metrics.successRate}%`);
    console.log(`    Peak Rate: ${metrics.peakRate.toFixed(1)} jobs/s`);
    console.log(`    Average Rate: ${metrics.averageRate.toFixed(1)} jobs/s`);
  }

  private calculateSuccessRate(completed: number, failed: number): number {
    const total = completed + failed;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private analyzePerformance(
    emailMetrics: any,
    pushMetrics: any,
    smsMetrics: any,
    inAppMetrics: any,
    systemMetrics: any
  ): void {
    console.log('Performance Analysis:');
    console.log('====================');

    // Success rate analysis
    const allSuccessRates = [emailMetrics.successRate, pushMetrics.successRate,
                           smsMetrics.successRate, inAppMetrics.successRate];
    const avgSuccessRate = allSuccessRates.reduce((a, b) => a + b, 0) / allSuccessRates.length;

    console.log(`  Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);

    if (avgSuccessRate < 95) {
      console.log('  ⚠️ Success rate below 95% - investigate failures');
    }

    // Throughput analysis
    const totalThroughput = emailMetrics.averageRate + pushMetrics.averageRate +
                          smsMetrics.averageRate + inAppMetrics.averageRate;
    console.log(`  Total Throughput: ${totalThroughput.toFixed(1)} jobs/s`);

    if (totalThroughput < 10) {
      console.log('  ⚠️ Low throughput detected - consider optimizing processors');
    }

    // Memory analysis
    const memoryGrowth = systemMetrics.finalMemory - systemMetrics.initialMemory;
    if (memoryGrowth > 100) {
      console.log('  ⚠️ High memory growth detected - potential memory leak');
    }

    // Bottleneck analysis
    const lowestSuccessRate = Math.min(...allSuccessRates);
    const lowestThroughput = Math.min(
      emailMetrics.averageRate, pushMetrics.averageRate,
      smsMetrics.averageRate, inAppMetrics.averageRate
    );

    console.log(`  Bottleneck Detection:`);

    if (lowestSuccessRate < 90) {
      const queueWithLowestSuccess = ['Email', 'Push', 'SMS', 'In-App'][allSuccessRates.indexOf(lowestSuccessRate)];
      console.log(`    ⚠️ ${queueWithLowestSuccess} has low success rate (${lowestSuccessRate.toFixed(1)}%)`);
    }

    if (lowestThroughput < 1) {
      const queueWithLowestThroughput = ['Email', 'Push', 'SMS', 'In-App'][[emailMetrics.averageRate, pushMetrics.averageRate, smsMetrics.averageRate, inAppMetrics.averageRate].indexOf(lowestThroughput)];
      console.log(`    ⚠️ ${queueWithLowestThroughput} has low throughput (${lowestThroughput.toFixed(1)} jobs/s)`);
    }

    console.log('\n💡 Recommendations:');

    if (emailMetrics.successRate < 95) {
      console.log('  - Optimize email processor and check SMTP configuration');
    }

    if (pushMetrics.successRate < 95) {
      console.log('  - Review Firebase configuration and device token management');
    }

    if (smsMetrics.successRate < 95) {
      console.log('  - Check SMS provider settings and phone number validation');
    }

    if (systemMetrics.finalMemory > 500) {
      console.log('  - Monitor memory usage and implement cleanup strategies');
    }

    if (totalThroughput < 50) {
      console.log('  - Consider increasing queue concurrency and worker processes');
    }

    console.log('  - Set up automated monitoring and alerting');
    console.log('  - Implement circuit breakers for external service failures');
    console.log('  - Add retry policies with exponential backoff');
  }
}

async function main() {
  let app;

  try {
    const config: LoadTestConfig = {
      emailJobs: 100,
      pushJobs: 80,
      smsJobs: 50,
      inAppJobs: 120,
      concurrentBatches: 10,
      batchDelay: 1000,
      monitoringInterval: 2000,
    };

    // Override config from command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
      console.log('Usage: ts-node load-test.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --email <number>     Number of email jobs (default: 100)');
      console.log('  --push <number>      Number of push jobs (default: 80)');
      console.log('  --sms <number>       Number of SMS jobs (default: 50)');
      console.log('  --inapp <number>     Number of in-app jobs (default: 120)');
      console.log('  --monitoring <ms>    Monitoring interval in ms (default: 2000)');
      console.log('');
      process.exit(0);
    }

    // Parse custom arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--email') config.emailJobs = parseInt(args[i + 1]);
      if (args[i] === '--push') config.pushJobs = parseInt(args[i + 1]);
      if (args[i] === '--sms') config.smsJobs = parseInt(args[i + 1]);
      if (args[i] === '--inapp') config.inAppJobs = parseInt(args[i + 1]);
      if (args[i] === '--monitoring') config.monitoringInterval = parseInt(args[i + 1]);
    }

    console.log('🔧 Initializing NestJS application...\n');

    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'], // Minimal logging during load test
    });

    const emailQueue = app.get(getQueueToken('notifications:email'));
    const pushQueue = app.get(getQueueToken('notifications:push'));
    const smsQueue = app.get(getQueueToken('notifications:sms'));
    const inAppQueue = app.get(getQueueToken('notifications:in-app'));
    const configService = app.get(ConfigService);

    const tester = new NotificationLoadTester(
      emailQueue,
      pushQueue,
      smsQueue,
      inAppQueue,
      configService,
    );

    await tester.runLoadTest(config);

  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Load test interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Load test terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}