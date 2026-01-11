import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ValidatorNodeModule } from "./modules/validators/validator-node.module";
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(ValidatorNodeModule);

  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    }));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true
  });

  const port = configService.get<number>('VALIDATOR_PORT', 3000);

  await app.listen(port);

  const validatorId = configService.get<string>('VALIDATOR_ID', 'unknown-validator');
  console.log(`🚀 Validator Node ${validatorId} is running on port ${port}`);
}

bootstrap();
