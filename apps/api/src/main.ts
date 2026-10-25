import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function validateEnv(config: ConfigService): void {
  // Skip validation in test environment (integration tests mock dependencies)
  if (config.get<string>('NODE_ENV') === 'test') {
    return;
  }

  const requiredVars: Array<{ key: string; name: string }> = [
    { key: 'DATABASE_URL', name: 'Database URL' },
    { key: 'JWT_SECRET', name: 'JWT secret' },
  ];

  const missing = requiredVars.filter((v) => !config.get<string>(v.key));
  if (missing.length > 0) {
    const names = missing.map((v) => v.name).join(', ');
    throw new Error(`Missing required environment variables: ${names}`);
  }

  const dbUrl = config.get<string>('DATABASE_URL', '');
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://');
  }

  const jwtSecret = config.get<string>('JWT_SECRET', '');
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  if (isProduction && (jwtSecret.includes('change-me') || jwtSecret.includes('changeme'))) {
    throw new Error('JWT_SECRET must be changed from the default value in production');
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  validateEnv(config);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Global Interceptors & Filters
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ValoraSec API')
    .setDescription('Open-source security platform for Soroban smart contracts on Stellar')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Projects', 'Project management')
    .addTag('Scans', 'Security scan operations')
    .addTag('Reports', 'Audit report management')
    .addTag('Audit Registry', 'On-chain audit verification')
    .addTag('Notifications', 'User notifications')
    .addTag('Health', 'System health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Start
  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.info(`🚀 ValoraSec API running on http://localhost:${port}`);
  console.info(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
