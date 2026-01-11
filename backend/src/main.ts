import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { WebSocketAdapter } from "./common/adapters/ws.adapter";
import { PrismaService } from "./prisma/prisma.service";

// Performance monitoring
const startTime = Date.now();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting ViralFX Backend API...');

    // Create NestJS application with enhanced logging
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
      // Enable shutdown hooks for graceful termination
      shutdownHooks: true,
    });

    const configService = app.get(ConfigService);
    const environment = configService.get('NODE_ENV', 'development');

    logger.log(`✅ Application created successfully (${environment} mode)`);

    // ========================================================================
    // SECURITY MIDDLEWARE
    // ========================================================================

    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    const corsOrigin = configService.get('CORS_ORIGIN', '*');
    app.enableCors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-ID']
    });

    // Compression middleware
    app.use(compression({
      threshold: 1024, // Only compress responses larger than 1KB
      level: 6, // Compression level (0-9)
    }));

    // ========================================================================
    // GLOBAL PIPES, FILTERS, AND INTERCEPTORS
    // ========================================================================

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true
        },
        exceptionFactory: (errors) => {
          const errorsMessages = errors.map(error => ({
            field: error.property,
            message: Object.values(error.constraints || {}).join(', ')
          }));
          return new Error(JSON.stringify(errorsMessages));
        }
      })
    );

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalFilters(new PrismaExceptionFilter());

    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalInterceptors(new TransformInterceptor());

    // ========================================================================
    // WEBSOCKET ADAPTER
    // ========================================================================

    app.useWebSocketAdapter(new WebSocketAdapter(app));

    // ========================================================================
    // API PREFIX AND ROUTING
    // ========================================================================

    app.setGlobalPrefix('api/v1');

    // ========================================================================
    // OPENAPI DOCUMENTATION
    // ========================================================================

    const config = new DocumentBuilder()
      .setTitle('ViralFX API')
      .setDescription('Real-time social momentum trading platform API with institutional-grade reliability')
      .setVersion('1.0.0')
      .setContact('ViralFX Support', 'https://viralfx.com/support', 'support@viralfx.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header'
        },
        'JWT-auth')
      .addTag('health', 'Health check and monitoring endpoints')
      .addTag('auth', 'Authentication and authorization')
      .addTag('users', 'User management')
      .addTag('topics', 'Topic discovery and management')
      .addTag('markets', 'Trading markets and bets')
      .addTag('viral', 'Viral Index data and analytics')
      .addTag('wallet', 'Wallet and transactions')
      .addTag('payments', 'Payment processing')
      .addTag('chat', 'Real-time chat')
      .addTag('notifications', 'Notification system')
      .addTag('files', 'File uploads and storage')
      .addTag('admin', 'Admin and forensics')
      .addServer('http://localhost:3000', 'Development server')
      .addServer('https://api.viralfx.com', 'Production server')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true
    });

    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'ViralFX API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .scheme-container { margin: 20px 0 }
        .swagger-ui .info .title { font-size: 32px }
        .swagger-ui .opblock-tag { font-size: 16px; font-weight: bold; }
      `
    });

    logger.log('📚 API Documentation configured at /api/docs');

    // ========================================================================
    // HEALTH CHECK ENDPOINTS (for load balancers and Kubernetes)
    // ========================================================================
    // NOTE: Disabled to prevent conflicts with NestJS routing
    // Health checks are handled by AppController in app.controller.ts

    // app.getHttpServer().on('request', (req, res) => {
    //   // Basic health check (for load balancers)
    //   if (req.url === '/health') {
    //     res.writeHead(200, { 'Content-Type': 'application/json' });
    //     res.end(JSON.stringify({
    //       status: 'ok',
    //       timestamp: new Date().toISOString(),
    //       uptime: process.uptime(),
    //       environment: environment
    //     }));
    //   }
    //
    //   // Readiness probe (for Kubernetes)
    //   if (req.url === '/health/ready') {
    //     res.writeHead(200, { 'Content-Type': 'application/json' });
    //     res.end(JSON.stringify({
    //       ready: true,
    //       timestamp: new Date().toISOString()
    //     }));
    //   }
    //
    //   // Liveness probe (for Kubernetes)
    //   if (req.url === '/health/live') {
    //     res.writeHead(200, { 'Content-Type': 'application/json' });
    //     res.end(JSON.stringify({
    //       alive: true,
    //       uptime: process.uptime(),
    //       timestamp: new Date().toISOString()
    //     }));
    //   }
    // });

    // ========================================================================
    // VERIFY CRITICAL SERVICES
    // ========================================================================

    logger.log('🔍 Verifying critical service connections...');

    try {
      const prisma = app.get(PrismaService);
      await prisma.$connect();
      logger.log('✅ Database connection verified');
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      process.exit(1);
    }

    // ========================================================================
    // GRACEFUL SHUTDOWN HANDLERS
    // ========================================================================

    // Enable NestJS shutdown hooks
    app.enableShutdownHooks();

    // SIGTERM - Kubernetes pod termination
    process.on('SIGTERM', async () => {
      logger.log('========================================');
      logger.log('SIGTERM received - Kubernetes pod termination');
      logger.log('========================================');

      try {
        // Stop accepting new connections
        logger.log('Stopping acceptance of new connections...');

        // Give ongoing requests time to complete (max 30 seconds)
        const shutdownTimeout = 30000;
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, shutdownTimeout);
          // In a real scenario, you'd track active requests here
          logger.log(`Waiting ${shutdownTimeout}ms for ongoing requests...`);
        });

        // Close the application
        await app.close();
        logger.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // SIGINT - Ctrl+C
    process.on('SIGINT', async () => {
      logger.log('========================================');
      logger.log('SIGINT received - Manual termination');
      logger.log('========================================');

      try {
        await app.close();
        logger.log('✅ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // ========================================================================
    // START SERVER
    // ========================================================================

    const port = configService.get('PORT', 3000);
    const host = configService.get('HOST', '127.0.0.1');

    await app.listen(port, host);

    const bootTime = Date.now() - startTime;

    logger.log('');
    logger.log('========================================');
    logger.log('🎉 ViralFX Backend API Started Successfully');
    logger.log('========================================');
    logger.log(`🌍 Environment: ${environment}`);
    logger.log(`🏠 Server running on: http://${host}:${port}`);
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
    logger.log(`🏥 Health Check: http://${host}:${port}/health`);
    logger.log(`🔍 Readiness Probe: http://${host}:${port}/health/ready`);
    logger.log(`💓 Liveness Probe: http://${host}:${port}/health/live`);
    logger.log(`⏱️  Boot Time: ${bootTime}ms`);
    logger.log(`🕐 Started at: ${new Date().toISOString()}`);
    logger.log('========================================');
    logger.log('');

  } catch (error) {
    logger.error('========================================');
    logger.error('❌ CRITICAL ERROR DURING BOOTSTRAP');
    logger.error('========================================');
    logger.error(`Error Name: ${error.name}`);
    logger.error(`Error Message: ${error.message}`);
    if (error.stack) {
      logger.error('Full Stack Trace:');
      logger.error(error.stack);
    }
    if (error.code) {
      logger.error(`Error Code: ${error.code}`);
    }
    process.exit(1);
  }
}

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('Process');
  logger.error('========================================');
  logger.error('💥 UNHANDLED PROMISE REJECTION');
  logger.error('========================================');
  logger.error('Reason:', reason);
  logger.error('Promise:', promise);
  // Don't exit in production, log and continue
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('Process');
  logger.error('========================================');
  logger.error('💥 UNCAUGHT EXCEPTION');
  logger.error('========================================');
  logger.error('Error:', error.message);
  logger.error('Stack:', error.stack);
  // Exit immediately - uncaught exceptions are dangerous
  process.exit(1);
});

// Handle warning about multiple resolves
process.on('multipleResolves', (type, promise, reason) => {
  const logger = new Logger('Process');
  logger.warn('========================================');
  logger.warn('⚠️  MULTIPLE RESOLVES DETECTED');
  logger.warn('========================================');
  logger.warn('Type:', type);
  logger.warn('Reason:', reason);
});

// ============================================================================
// START APPLICATION
// ============================================================================

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('========================================');
  logger.error('❌ FATAL ERROR - BOOTSTRAP FAILED');
  logger.error('========================================');
  logger.error('Error:', error);
  if (error.stack) {
    logger.error('Stack:', error.stack);
  }
  process.exit(1);
});
