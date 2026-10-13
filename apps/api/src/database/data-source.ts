import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ServiceCategory } from '../discovery/entities/service-category.entity.js';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { Favorite } from '../identity/entities/favorite.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { PLATFORM_ENTITIES } from '../platform/entities.js';
import { InitialDiscoverySchema1728730000000 } from './migrations/1728730000000-InitialDiscoverySchema.js';
import { IdentityAndFavorites1728731000000 } from './migrations/1728731000000-IdentityAndFavorites.js';
import { PlatformPhases1728732000000 } from './migrations/1728732000000-PlatformPhases.js';
import { ExternalPlaceDiscovery1728733000000 } from './migrations/1728733000000-ExternalPlaceDiscovery.js';

const localDatabaseUrl = 'postgresql://nearfind:nearfind_local@localhost:5432/nearfind';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL;

if ((nodeEnv === 'staging' || nodeEnv === 'production') && !databaseUrl) {
  throw new Error('DATABASE_URL is required in staging and production');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl ?? localDatabaseUrl,
  entities: [ServiceCategory, ServiceLocation, User, Favorite, ...PLATFORM_ENTITIES],
  migrations: [
    InitialDiscoverySchema1728730000000,
    IdentityAndFavorites1728731000000,
    PlatformPhases1728732000000,
    ExternalPlaceDiscovery1728733000000,
  ],
  synchronize: false,
  logging: nodeEnv === 'development',
});
