import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { IngestService } from '../services/ingest.service';

@Injectable()
export class IngestScheduler {
  private readonly logger = new Logger(IngestScheduler.name);

  constructor(
    private readonly ingestService: IngestService,
    private readonly configService: ConfigService,
  ) {}

  // Twitter collection every 2 minutes
  @Cron('*/2 * * * *')
  async collectTwitterData() {
    if (!this.isPlatformEnabled('TWITTER')) {
      return;
    }

    try {
      this.logger.debug('Starting Twitter data collection...');
      const result = await this.ingestService.collectFromPlatform('twitter');

      if (result.collected > 0) {
        this.logger.log(`Twitter collection completed: ${result.collected} items collected, ${result.failed} failed`);
      } else {
        this.logger.debug('Twitter collection completed: no new items');
      }

      if (result.errors.length > 0) {
        this.logger.warn('Twitter collection errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to collect Twitter data:', error);
    }
  }

  // TikTok collection every 5 minutes (considering rate limits)
  @Cron('*/5 * * * *')
  async collectTikTokData() {
    if (!this.isPlatformEnabled('TIKTOK')) {
      return;
    }

    try {
      this.logger.debug('Starting TikTok data collection...');
      const result = await this.ingestService.collectFromPlatform('tiktok');

      if (result.collected > 0) {
        this.logger.log(`TikTok collection completed: ${result.collected} items collected, ${result.failed} failed`);
      } else {
        this.logger.debug('TikTok collection completed: no new items');
      }

      if (result.errors.length > 0) {
        this.logger.warn('TikTok collection errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to collect TikTok data:', error);
    }
  }

  // Instagram collection every 5 minutes
  @Cron('*/5 * * * *')
  async collectInstagramData() {
    if (!this.isPlatformEnabled('INSTAGRAM')) {
      return;
    }

    try {
      this.logger.debug('Starting Instagram data collection...');
      const result = await this.ingestService.collectFromPlatform('instagram');

      if (result.collected > 0) {
        this.logger.log(`Instagram collection completed: ${result.collected} items collected, ${result.failed} failed`);
      } else {
        this.logger.debug('Instagram collection completed: no new items');
      }

      if (result.errors.length > 0) {
        this.logger.warn('Instagram collection errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to collect Instagram data:', error);
    }
  }

  // YouTube collection every 3 minutes (higher frequency for news content)
  @Cron('*/3 * * * *')
  async collectYouTubeData() {
    if (!this.isPlatformEnabled('YOUTUBE')) {
      return;
    }

    try {
      this.logger.debug('Starting YouTube data collection...');
      const result = await this.ingestService.collectFromPlatform('youtube');

      if (result.collected > 0) {
        this.logger.log(`YouTube collection completed: ${result.collected} items collected, ${result.failed} failed`);
      } else {
        this.logger.debug('YouTube collection completed: no new items');
      }

      if (result.errors.length > 0) {
        this.logger.warn('YouTube collection errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to collect YouTube data:', error);
    }
  }

  // Facebook collection every 5 minutes
  @Cron('*/5 * * * *')
  async collectFacebookData() {
    if (!this.isPlatformEnabled('FACEBOOK')) {
      return;
    }

    try {
      this.logger.debug('Starting Facebook data collection...');
      const result = await this.ingestService.collectFromPlatform('facebook');

      if (result.collected > 0) {
        this.logger.log(`Facebook collection completed: ${result.collected} items collected, ${result.failed} failed`);
      } else {
        this.logger.debug('Facebook collection completed: no new items');
      }

      if (result.errors.length > 0) {
        this.logger.warn('Facebook collection errors:', result.errors);
      }
    } catch (error) {
      this.logger.error('Failed to collect Facebook data:', error);
    }
  }

  // Comprehensive collection run every 30 minutes
  @Cron('*/30 * * * *')
  async collectFromAllPlatforms() {
    try {
      this.logger.debug('Starting comprehensive collection from all platforms...');
      const results = await this.ingestService.collectFromAllPlatforms();

      let totalCollected = 0;
      let totalFailed = 0;

      results.forEach(result => {
        totalCollected += result.collected;
        totalFailed += result.failed;

        if (result.errors.length > 0) {
          this.logger.warn(`${result.platform} collection errors:`, result.errors);
        }
      });

      if (totalCollected > 0) {
        this.logger.log(`Comprehensive collection completed: ${totalCollected} total items collected, ${totalFailed} failed`);
      } else {
        this.logger.debug('Comprehensive collection completed: no new items from any platform');
      }
    } catch (error) {
      this.logger.error('Failed to run comprehensive collection:', error);
    }
  }

  // Cleanup old Redis cache entries every 6 hours
  @Cron('0 */6 * * *')
  async cleanupOldContent() {
    try {
      this.logger.debug('Starting cleanup of old Redis cache entries...');

      // Clean up old running flags
      const platforms = ['twitter', 'tiktok', 'instagram', 'youtube', 'facebook'];
      for (const platform of platforms) {
        await this.ingestService.stopCollection(platform);
      }

      // Clean up old failed content entries (keep last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Note: Redis cleanup logic would be implemented here based on specific requirements
      // This is a placeholder for cleanup operations

      this.logger.log('Redis cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup old Redis entries:', error);
    }
  }

  // Health check every hour
  @Cron('0 * * * *')
  async healthCheck() {
    try {
      this.logger.debug('Performing ingest system health check...');
      const status = await this.ingestService.getCollectionStatus();

      // Check if any platform has been running for too long (more than 10 minutes)
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      let issuesFound = 0;

      for (const platformStatus of status.platforms) {
        if (platformStatus.isRunning) {
          // If we don't have a lastRun time but it's running, it might be stuck
          if (!platformStatus.lastRun || platformStatus.lastRun < tenMinutesAgo) {
            this.logger.warn(`Platform ${platformStatus.platform} appears to be stuck, forcing stop`);
            await this.ingestService.stopCollection(platformStatus.platform);
            issuesFound++;
          }
        }
      }

      if (issuesFound > 0) {
        this.logger.warn(`Health check completed with ${issuesFound} issues resolved`);
      } else {
        this.logger.debug('Health check completed successfully');
      }

    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  // Daily statistics summary at midnight
  @Cron('0 0 * * *')
  async dailyStatisticsSummary() {
    try {
      this.logger.debug('Generating daily statistics summary...');

      const status = await this.ingestService.getCollectionStatus();

      const summary = {
        date: new Date().toISOString().split('T')[0],
        totalCollected: status.totalCollected,
        totalFailed: status.totalFailed,
        platformBreakdown: status.platforms.reduce((acc, platform) => {
          acc[platform.platform] = {
            collected: platform.totalCollected,
            failed: platform.totalFailed,
          };
          return acc;
        }, {} as Record<string, { collected: number; failed: number }>),
      };

      this.logger.log(`Daily statistics summary: ${JSON.stringify(summary)}`);

      // Store summary in Redis for historical tracking
      const redis = this.ingestService['redis']; // Access Redis instance from service
      await redis.hset('ingest:daily:stats', summary.date, JSON.stringify(summary));

    } catch (error) {
      this.logger.error('Failed to generate daily statistics summary:', error);
    }
  }

  private isPlatformEnabled(platform: string): boolean {
    return this.configService.get<boolean>(`${platform}_ENABLED`, false);
  }
}