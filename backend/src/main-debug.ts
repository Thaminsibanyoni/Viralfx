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

async function bootstrap() {
  const logger = new Logger('Bootstrap-DEBUG');

  try {
    logger.log('🔍 DEBUG: Starting NestJS application creation...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose']
    });
    logger.log('✅ DEBUG: NestFactory.create() successful');

    const configService = app.get(ConfigService);
    logger.log('✅ DEBUG: ConfigService retrieved');

    // Security middleware
    logger.log('🔧 DEBUG: Applying helmet middleware...');
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));
    logger.log('✅ DEBUG: Helmet middleware applied');

    // CORS configuration
    const corsOrigin = configService.get('CORS_ORIGIN', '*');
    app.enableCors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
    logger.log('✅ DEBUG: CORS configured');

    // Compression
    logger.log('🔧 DEBUG: Applying compression middleware...');
    app.use(compression());
    logger.log('✅ DEBUG: Compression middleware applied');

    // Global pipes
    logger.log('🔧 DEBUG: Setting up global pipes...');
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
    logger.log('✅ DEBUG: Global pipes configured');

    // Global filters
    logger.log('🔧 DEBUG: Setting up global filters...');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalFilters(new PrismaExceptionFilter());
    logger.log('✅ DEBUG: Global filters configured');

    // Global interceptors
    logger.log('🔧 DEBUG: Setting up global interceptors...');
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalInterceptors(new TransformInterceptor());
    logger.log('✅ DEBUG: Global interceptors configured');

    // WebSocket adapter
    logger.log('🔧 DEBUG: Setting up WebSocket adapter...');
    app.useWebSocketAdapter(new WebSocketAdapter(app));
    logger.log('✅ DEBUG: WebSocket adapter configured');

    // API prefix
    app.setGlobalPrefix('api/v1');
    logger.log('✅ DEBUG: Global prefix set to /api/v1');

    // OpenAPI documentation
    logger.log('🔧 DEBUG: Setting up Swagger documentation...');
    const config = new DocumentBuilder()
      .setTitle('ViralFX API')
      .setDescription('Real-time social momentum trading platform API')
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
      `
    });
    logger.log('✅ DEBUG: Swagger documentation configured');

    // Health check endpoint
    app.getHttpServer().on('request', (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: configService.get('NODE_ENV', 'development')
        }));
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received. Shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT received. Shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    // Verify Prisma client is functional
    logger.log('🔧 DEBUG: Verifying Prisma client connection...');
    try {
      const prisma = app.get(PrismaService);
      await prisma.$connect();
      logger.log('✅ DEBUG: Prisma client connected successfully');
    } catch (error) {
      logger.error('❌ DEBUG: Prisma client connection failed');
      logger.error(error);
      process.exit(1);
    }

    // Start server
    const port = configService.get('PORT', 3000);
    const host = configService.get('HOST', '0.0.0.0');

    logger.log(`🚀 DEBUG: Starting server on ${host}:${port}...`);
    await app.listen(port, host);

    logger.log(`🎉 SUCCESS: Backend running on: http://localhost:${port}`);
    logger.log(`📚 API Documentation: http://localhost:${port}/api`);
    logger.log(`🔍 Health Check: http://localhost:${port}/health`);
    logger.log(`
🚀 ViralFX Backend API running on http://${host}:${port}
📚 API Documentation: http://${host}:${port}/api/docs
🏥 Health Check: http://${host}:${port}/health
🌍 Environment: ${configService.get('NODE_ENV', 'development')}
⏰ Started at: ${new Date().toISOString()}
  `);
  } catch (error) {
    logger.error('❌ CRITICAL ERROR DURING BOOTSTRAP:');
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('Process');
  logger.error('Unhandled Rejection at:', reason, promise);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger('Process');
  logger.error('Uncaught Exception:', error.stack);
  process.exit(1);
});

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal Error - Bootstrap Failed:', error.stack);
  process.exit(1);
});
