import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { z } from 'zod';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { HealthController } from './health/health.controller.js';

const localDatabaseUrl = 'postgresql://nearfind:nearfind_local@localhost:5432/nearfind';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),
    OIDC_ISSUER_URL: z.string().url().optional(),
    OIDC_AUDIENCE: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if ((env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') && !env.DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required in staging and production',
      });
    }
  });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.parse(config);
        return {
          ...parsed,
          DATABASE_URL: parsed.DATABASE_URL ?? localDatabaseUrl,
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    DiscoveryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
