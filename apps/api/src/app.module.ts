import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { z } from 'zod';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { HealthController } from './health/health.controller.js';
import { IdentityModule } from './identity/identity.module.js';
import { PlatformModule } from './platform/platform.module.js';

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
    OIDC_JWKS_URL: z.string().url().optional(),
    OIDC_ALLOWED_ALGORITHMS: z.string().default('RS256'),
    FIELD_ENCRYPTION_KEY: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    EMERGENCY_REGION: z.string().min(2).max(20).default('IN'),
    EMERGENCY_NUMBER: z.string().min(2).max(20).default('112'),
    EXTERNAL_PLACES_PROVIDER: z.enum(['none', 'overpass']).default('none'),
    OVERPASS_API_URL: z.string().url().optional(),
    EXTERNAL_PLACES_USER_AGENT: z.string().min(8).max(240).optional(),
    EXTERNAL_PLACES_DEFAULT_COUNTRY: z.string().regex(/^[A-Za-z]{2}$/).default('IN'),
    EXTERNAL_PLACES_MAX_RADIUS_METERS: z.coerce.number().int().min(100).max(20_000).default(10_000),
  })
  .superRefine((env, context) => {
    const deployed = env.NODE_ENV === 'staging' || env.NODE_ENV === 'production';
    if (deployed && !env.DATABASE_URL) {
      context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL is required in staging and production' });
    }
    for (const key of ['OIDC_ISSUER_URL', 'OIDC_AUDIENCE', 'OIDC_JWKS_URL', 'FIELD_ENCRYPTION_KEY', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (deployed && !env[key]) {
        context.addIssue({ code: 'custom', path: [key], message: `${key} is required in staging and production` });
      }
    }
    if (env.NODE_ENV === 'production' && env.S3_ENDPOINT && !env.S3_ENDPOINT.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'S3_ENDPOINT must use HTTPS in production' });
    }
    if (deployed && env.EXTERNAL_PLACES_PROVIDER === 'none') {
      context.addIssue({ code: 'custom', path: ['EXTERNAL_PLACES_PROVIDER'], message: 'An external places provider is required in staging and production' });
    }
    if (env.EXTERNAL_PLACES_PROVIDER === 'overpass' && deployed && !env.OVERPASS_API_URL) {
      context.addIssue({ code: 'custom', path: ['OVERPASS_API_URL'], message: 'OVERPASS_API_URL is required for deployed Overpass discovery' });
    }
    if (env.EXTERNAL_PLACES_PROVIDER === 'overpass' && deployed && !env.EXTERNAL_PLACES_USER_AGENT) {
      context.addIssue({ code: 'custom', path: ['EXTERNAL_PLACES_USER_AGENT'], message: 'Identify NearFind to the Overpass operator with a contactable User-Agent' });
    }
    if (env.NODE_ENV === 'production' && env.OVERPASS_API_URL) {
      const host = new URL(env.OVERPASS_API_URL).hostname.toLowerCase();
      if (host === 'overpass-api.de' || host.endsWith('.overpass-api.de')) {
        context.addIssue({
          code: 'custom',
          path: ['OVERPASS_API_URL'],
          message: 'Use a self-hosted or commercial Overpass endpoint in production; public community instances are not a production dependency',
        });
      }
    }
  });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.parse(config);
        return { ...parsed, DATABASE_URL: parsed.DATABASE_URL ?? localDatabaseUrl };
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
    IdentityModule,
    PlatformModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
