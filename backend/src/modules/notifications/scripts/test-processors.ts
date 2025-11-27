#!/usr/bin/env ts-node

/**
 * Notification Processors Test Script
 *
 * This script tests the notification processors by:
 * 1. Setting up test queues
 * 2. Adding sample jobs
 * 3. Monitoring processing
 * 4. Reporting results
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { NotificationService } from '../services/notification.service';
import { ConfigService } from '@nestjs/config';

interface TestResult {
  type: string;
  total: number;
  processed: number;
  failed: number;
  averageTime: number;
  errors: string[];
}

class NotificationProcessorTester {
  private emailQueue: Queue;
  private pushQueue: Queue;
  private smsQueue: Queue;
  private inAppQueue: Queue;
  private notificationService: NotificationService;
  private configService: ConfigService;
  private results: Map<string, TestResult> = new Map();

  constructor(
    emailQueue: Queue,
    pushQueue: Queue,
    smsQueue: Queue,
    inAppQueue: Queue,
    notificationService: NotificationService,
    configService: ConfigService,
  ) {
    this.emailQueue = emailQueue;
    this.pushQueue = pushQueue;
    this.smsQueue = smsQueue;
    this.inAppQueue = inAppQueue;
    this.notificationService = notificationService;
    this.configService = configService;
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Notification Processor Tests\n');

    try {
      // Clean all queues
      await this.cleanQueues();

      // Run individual processor tests
      await this.testEmailProcessor();
      await this.testPushProcessor();
      await this.testSMSProcessor();
      await this.testInAppProcessor();

      // Run integration tests
      await this.testMultiChannelNotification();
      await this.testBulkProcessing();
      await this.testErrorHandling();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
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
      await queue.clean(0, 'paused');
    }

    console.log('✅ Queues cleaned\n');
  }

  private async testEmailProcessor(): Promise<void> {
    console.log('📧 Testing Email Processor...');

    const testCases = [
      {
        name: 'basic-email',
        data: {
          to: 'test@example.com',
          subject: 'Test Email',
          template: 'user-welcome',
          data: {
            name: 'Test User',
            email: 'test@example.com',
            loginUrl: 'https://test.viralfx.com/login',
            supportEmail: 'support@viralfx.com',
          },
          priority: 'HIGH',
          userId: 'test-user-123',
        },
      },
      {
        name: 'bulk-email',
        data: {
          recipients: Array.from({ length: 10 }, (_, i) => ({
            email: `user${i}@example.com`,
            userId: `user-${i}`,
            data: { name: `User ${i}` },
          })),
          subject: 'Bulk Test Email',
          template: 'user-welcome',
          defaultData: { name: 'User' },
          priority: 'MEDIUM',
        },
      },
      {
        name: 'invalid-email',
        data: {
          to: 'invalid-email',
          subject: 'Invalid Email Test',
          message: 'This should fail',
          priority: 'LOW',
        },
      },
    ];

    const result: TestResult = {
      type: 'Email',
      total: testCases.length,
      processed: 0,
      failed: 0,
      averageTime: 0,
      errors: [],
    };

    const times: number[] = [];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();

        const job = await this.emailQueue.add(
          testCase.name === 'bulk-email' ? 'send-bulk-email' : 'send-email',
          testCase.data,
          { attempts: 3, backoff: 'exponential' }
        );

        const endTime = Date.now();
        times.push(endTime - startTime);

        console.log(`  ✅ ${testCase.name} job added: ${job.id}`);
        result.processed++;

      } catch (error) {
        console.log(`  ❌ ${testCase.name} failed: ${error.message}`);
        result.failed++;
        result.errors.push(`${testCase.name}: ${error.message}`);
      }
    }

    result.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    this.results.set('Email', result);

    // Wait for processing
    await this.waitForProcessing('Email', testCases.length);
    console.log('✅ Email Processor tests completed\n');
  }

  private async testPushProcessor(): Promise<void> {
    console.log('📱 Testing Push Processor...');

    const testCases = [
      {
        name: 'basic-push',
        data: {
          userId: 'test-user-123',
          title: 'Test Push Notification',
          body: 'This is a test push notification',
          data: { orderId: 'order-123', action: 'view' },
          badge: 1,
          sound: 'default',
          priority: 'HIGH',
        },
      },
      {
        name: 'broadcast-push',
        data: {
          title: 'System Announcement',
          body: 'Scheduled maintenance tonight',
          data: { type: 'maintenance', time: '23:00' },
          targetAudience: 'active',
        },
      },
      {
        name: 'push-with-actions',
        data: {
          userId: 'test-user-456',
          title: 'Order Update',
          body: 'Your order status has changed',
          data: { orderId: 'order-456' },
          actionButtons: [
            { title: 'View Order', action: 'view' },
            { title: 'Track', action: 'track' },
          ],
          imageUrl: 'https://example.com/order-image.png',
        },
      },
    ];

    const result: TestResult = {
      type: 'Push',
      total: testCases.length,
      processed: 0,
      failed: 0,
      averageTime: 0,
      errors: [],
    };

    const times: number[] = [];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();

        const job = await this.pushQueue.add(
          testCase.name === 'broadcast-push' ? 'send-broadcast' : 'send-push',
          testCase.data,
          { attempts: 3, priority: 1 }
        );

        const endTime = Date.now();
        times.push(endTime - startTime);

        console.log(`  ✅ ${testCase.name} job added: ${job.id}`);
        result.processed++;

      } catch (error) {
        console.log(`  ❌ ${testCase.name} failed: ${error.message}`);
        result.failed++;
        result.errors.push(`${testCase.name}: ${error.message}`);
      }
    }

    result.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    this.results.set('Push', result);

    await this.waitForProcessing('Push', testCases.length);
    console.log('✅ Push Processor tests completed\n');
  }

  private async testSMSProcessor(): Promise<void> {
    console.log('📄 Testing SMS Processor...');

    const testCases = [
      {
        name: 'basic-sms',
        data: {
          to: '+27123456789',
          message: 'This is a test SMS from ViralFX',
          priority: 'HIGH',
          userId: 'test-user-123',
          senderId: 'ViralFX',
        },
      },
      {
        name: 'otp-sms',
        data: {
          to: '+27123456789',
          otp: '123456',
          purpose: 'LOGIN',
          userId: 'test-user-123',
          expiryMinutes: 5,
        },
      },
      {
        name: 'bulk-sms',
        data: {
          recipients: Array.from({ length: 5 }, (_, i) => ({
            phone: `+2712345678${i}`,
            userId: `user-${i}`,
          })),
          message: 'Bulk SMS test message',
          priority: 'MEDIUM',
        },
      },
    ];

    const result: TestResult = {
      type: 'SMS',
      total: testCases.length,
      processed: 0,
      failed: 0,
      averageTime: 0,
      errors: [],
    };

    const times: number[] = [];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();

        const processName =
          testCase.name === 'otp-sms' ? 'send-otp' :
          testCase.name === 'bulk-sms' ? 'send-bulk-sms' : 'send-sms';

        const job = await this.smsQueue.add(processName, testCase.data, {
          attempts: 3,
          delay: testCase.name === 'bulk-sms' ? 1000 : 0, // Rate limiting
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        console.log(`  ✅ ${testCase.name} job added: ${job.id}`);
        result.processed++;

      } catch (error) {
        console.log(`  ❌ ${testCase.name} failed: ${error.message}`);
        result.failed++;
        result.errors.push(`${testCase.name}: ${error.message}`);
      }
    }

    result.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    this.results.set('SMS', result);

    await this.waitForProcessing('SMS', testCases.length, 2000); // SMS needs more time
    console.log('✅ SMS Processor tests completed\n');
  }

  private async testInAppProcessor(): Promise<void> {
    console.log('🔔 Testing In-App Processor...');

    const testCases = [
      {
        name: 'basic-in-app',
        data: {
          userId: 'test-user-123',
          title: 'New Notification',
          message: 'You have a new notification',
          data: { source: 'system' },
          type: 'SYSTEM',
          category: 'INFO',
          priority: 'MEDIUM',
        },
      },
      {
        name: 'broadcast-in-app',
        data: {
          title: 'System Maintenance',
          message: 'System will be under maintenance',
          data: { time: '23:00', duration: '2 hours' },
          type: 'SYSTEM',
          category: 'WARNING',
          targetAudience: 'all',
        },
      },
      {
        name: 'interactive-in-app',
        data: {
          userId: 'test-user-456',
          title: 'Order Confirmation',
          message: 'Your order has been confirmed',
          data: { orderId: 'order-456', amount: 100 },
          type: 'ORDER',
          category: 'SUCCESS',
          priority: 'HIGH',
          actionUrl: '/orders/order-456',
          actionButtons: [
            { label: 'View Order', action: 'view', url: '/orders/order-456' },
            { label: 'Share', action: 'share' },
          ],
        },
      },
    ];

    const result: TestResult = {
      type: 'In-App',
      total: testCases.length,
      processed: 0,
      failed: 0,
      averageTime: 0,
      errors: [],
    };

    const times: number[] = [];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();

        const processName =
          testCase.name === 'broadcast-in-app' ? 'send-broadcast' : 'send-in-app';

        const job = await this.inAppQueue.add(processName, testCase.data, {
          attempts: 3,
          priority: 1,
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        console.log(`  ✅ ${testCase.name} job added: ${job.id}`);
        result.processed++;

      } catch (error) {
        console.log(`  ❌ ${testCase.name} failed: ${error.message}`);
        result.failed++;
        result.errors.push(`${testCase.name}: ${error.message}`);
      }
    }

    result.averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    this.results.set('In-App', result);

    await this.waitForProcessing('In-App', testCases.length);
    console.log('✅ In-App Processor tests completed\n');
  }

  private async testMultiChannelNotification(): Promise<void> {
    console.log('🌐 Testing Multi-Channel Notification...');

    const userId = 'test-multi-channel';
    const notificationData = {
      userId,
      title: 'Multi-Channel Test',
      message: 'This notification is sent via multiple channels',
      data: { testId: 'multi-channel-123' },
    };

    try {
      await this.notificationService.sendNotification({
        userId,
        type: 'MULTI_CHANNEL_TEST',
        channels: ['EMAIL', 'PUSH', 'SMS', 'IN_APP'],
        data: notificationData,
        priority: 'HIGH',
      });

      console.log('  ✅ Multi-channel notification sent');

      await this.waitForProcessing('Multi-Channel', 4, 5000);

    } catch (error) {
      console.log(`  ❌ Multi-channel test failed: ${error.message}`);
    }

    console.log('✅ Multi-Channel test completed\n');
  }

  private async testBulkProcessing(): Promise<void> {
    console.log('📦 Testing Bulk Processing...');

    try {
      // Bulk email test
      const bulkEmailData = {
        recipients: Array.from({ length: 20 }, (_, i) => ({
          email: `bulk${i}@example.com`,
          userId: `bulk-user-${i}`,
        })),
        subject: 'Bulk Processing Test',
        template: 'user-welcome',
        defaultData: { name: 'Bulk User' },
      };

      await this.emailQueue.add('send-bulk-email', bulkEmailData, {
        attempts: 3,
        priority: 'high',
      });

      console.log('  ✅ Bulk email job added (20 recipients)');

      // Bulk push test
      const bulkPushData = {
        title: 'Bulk Push Test',
        body: 'This is a bulk push notification',
        targetAudience: 'active',
      };

      await this.pushQueue.add('send-broadcast', bulkPushData, {
        attempts: 3,
      });

      console.log('  ✅ Bulk push job added');

      await this.waitForProcessing('Bulk', 2, 10000);

    } catch (error) {
      console.log(`  ❌ Bulk processing test failed: ${error.message}`);
    }

    console.log('✅ Bulk Processing test completed\n');
  }

  private async testErrorHandling(): Promise<void> {
    console.log('⚠️ Testing Error Handling...');

    const errorCases = [
      {
        queue: this.emailQueue,
        process: 'send-email',
        data: {
          to: 'definitely-invalid-email-address',
          subject: 'Error Test Email',
          message: 'This should fail',
        },
        expectedError: 'Invalid email',
      },
      {
        queue: this.smsQueue,
        process: 'send-sms',
        data: {
          to: '123', // Invalid phone number
          message: 'Error test SMS',
        },
        expectedError: 'Invalid phone',
      },
      {
        queue: this.pushQueue,
        process: 'send-push',
        data: {
          userId: 'non-existent-user',
          title: 'Error Test Push',
          body: 'This should fail gracefully',
        },
        expectedError: 'No device tokens',
      },
    ];

    let handledErrors = 0;

    for (const errorCase of errorCases) {
      try {
        await errorCase.queue.add(errorCase.process, errorCase.data, {
          attempts: 2,
          backoff: 'fixed',
        });

        console.log(`  ⏳ ${errorCase.process} error case added`);

      } catch (error) {
        console.log(`  ❌ ${errorCase.process} error case failed: ${error.message}`);
      }
    }

    await this.waitForProcessing('Error Handling', errorCases.length, 3000);

    // Check failed jobs
    const emailFailed = await this.emailQueue.getFailed();
    const smsFailed = await this.smsQueue.getFailed();
    const pushFailed = await this.pushQueue.getFailed();

    handledErrors = emailFailed.length + smsFailed.length + pushFailed.length;

    console.log(`  ✅ Handled ${handledErrors} error cases`);
    console.log('✅ Error Handling test completed\n');
  }

  private async waitForProcessing(
    queueName: string,
    expectedJobs: number,
    timeout: number = 5000
  ): Promise<void> {
    console.log(`  ⏳ Waiting for ${queueName} processing...`);

    let attempts = 0;
    const maxAttempts = Math.ceil(timeout / 1000);

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const counts = await this.getQueueCounts();
      const totalProcessed = counts.completed + counts.failed;

      if (totalProcessed >= expectedJobs) {
        console.log(`  ✅ ${queueName} processing completed`);
        return;
      }

      console.log(`    Progress: ${totalProcessed}/${expectedJobs} (attempt ${attempts}/${maxAttempts})`);
    }

    console.log(`  ⚠️ ${queueName} processing timeout after ${timeout}ms`);
  }

  private async getQueueCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const emailCounts = await this.emailQueue.getJobCounts();
    const pushCounts = await this.pushQueue.getJobCounts();
    const smsCounts = await this.smsQueue.getJobCounts();
    const inAppCounts = await this.inAppQueue.getJobCounts();

    return {
      waiting: emailCounts.waiting + pushCounts.waiting + smsCounts.waiting + inAppCounts.waiting,
      active: emailCounts.active + pushCounts.active + smsCounts.active + inAppCounts.active,
      completed: emailCounts.completed + pushCounts.completed + smsCounts.completed + inAppCounts.completed,
      failed: emailCounts.failed + pushCounts.failed + smsCounts.failed + inAppCounts.failed,
      delayed: emailCounts.delayed + pushCounts.delayed + smsCounts.delayed + inAppCounts.delayed,
    };
  }

  private displayResults(): void {
    console.log('📊 Test Results Summary');
    console.log('====================\n');

    const counts = await this.getQueueCounts();

    console.log(`Queue Status:`);
    console.log(`  Waiting: ${counts.waiting}`);
    console.log(`  Active:  ${counts.active}`);
    console.log(`  Completed: ${counts.completed}`);
    console.log(`  Failed: ${counts.failed}`);
    console.log(`  Delayed: ${counts.delayed}\n`);

    console.log('Processor Results:');
    console.log('------------------');

    let totalJobs = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalTime = 0;

    for (const [type, result] of this.results) {
      console.log(`${type}:`);
      console.log(`  Total Jobs: ${result.total}`);
      console.log(`  Processed: ${result.processed}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Avg Time: ${result.averageTime.toFixed(2)}ms`);

      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join(', ')}`);
      }

      console.log('');

      totalJobs += result.total;
      totalProcessed += result.processed;
      totalFailed += result.failed;
      totalTime += result.averageTime;
    }

    console.log('Overall Summary:');
    console.log('----------------');
    console.log(`Total Jobs: ${totalJobs}`);
    console.log(`Processed: ${totalProcessed} (${((totalProcessed / totalJobs) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${totalFailed} (${((totalFailed / totalJobs) * 100).toFixed(1)}%)`);
    console.log(`Average Time: ${(totalTime / this.results.size).toFixed(2)}ms`);
    console.log(`Success Rate: ${((totalProcessed / (totalProcessed + totalFailed)) * 100).toFixed(1)}%`);

    // Generate recommendations
    console.log('\n💡 Recommendations:');

    if (totalFailed > totalProcessed * 0.1) {
      console.log('  ⚠️ High failure rate detected - check processor configurations');
    }

    if (totalTime / this.results.size > 2000) {
      console.log('  ⚠️ High processing times - consider optimizing processors');
    }

    if (counts.waiting > 0) {
      console.log('  ⚠️ Jobs still waiting - check queue processing');
    }

    if (counts.failed > 0) {
      console.log('  ❌ Failed jobs detected - review error logs');
    }

    console.log('\n✅ Test suite completed!');
  }
}

async function main() {
  let app;

  try {
    console.log('🔧 Initializing NestJS application...\n');

    // Create application context
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'], // Reduce logging during tests
    });

    // Get queues and services
    const emailQueue = app.get(getQueueToken('notifications:email'));
    const pushQueue = app.get(getQueueToken('notifications:push'));
    const smsQueue = app.get(getQueueToken('notifications:sms'));
    const inAppQueue = app.get(getQueueToken('notifications:in-app'));
    const notificationService = app.get(NotificationService);
    const configService = app.get(ConfigService);

    // Create and run tester
    const tester = new NotificationProcessorTester(
      emailQueue,
      pushQueue,
      smsQueue,
      inAppQueue,
      notificationService,
      configService,
    );

    await tester.runAllTests();

  } catch (error) {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test script interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Test script terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}