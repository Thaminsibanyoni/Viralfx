import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesService } from './services/files.service';
import { FilesController } from './controllers/files.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { MinioModule } from 'nestjs-minio-client';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    CacheModule.register({
      ttl: 600, // 10 minutes default TTL
      max: 200, // Maximum number of items in cache
    }),
    MinioModule.registerAsync({
      useFactory: () => ({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      }),
    }),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 10, // Max 10 files at once
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          // Images
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
          // Documents
          'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Archives
          'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
          // Video
          'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
          // Audio
          'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
          // Text
          'text/plain', 'text/csv', 'application/json',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
      },
    }),
    BullModule.registerQueue({
      name: 'file-processing',
    }),
    BullModule.registerQueue({
      name: 'file-scanning',
    }),
    BullModule.registerQueue({
      name: 'file-cleanup',
    }),
    BullModule.registerQueue({
      name: 'file-backup',
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}