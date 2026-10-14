import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
      bodyLimit: 1_048_576,
      requestTimeout: 15_000,
      connectionTimeout: 10_000,
    }),
    { bufferLogs: true },
  );
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: nodeEnv === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NearFind API')
    .setDescription('Public API contract for NearFind web and mobile clients.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'openapi.json' });

  app.enableShutdownHooks();
  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
