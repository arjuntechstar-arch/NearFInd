import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ServiceCategory } from '../discovery/entities/service-category.entity.js';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { InitialDiscoverySchema1728730000000 } from './migrations/1728730000000-InitialDiscoverySchema.js';

const localDatabaseUrl = 'postgresql://nearfind:nearfind_local@localhost:5432/nearfind';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const databaseUrl = process.env.DATABASE_URL;

if ((nodeEnv === 'staging' || nodeEnv === 'production') && !databaseUrl) {
  throw new Error('DATABASE_URL is required in staging and production');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl ?? localDatabaseUrl,
  entities: [ServiceCategory, ServiceLocation],
  migrations: [InitialDiscoverySchema1728730000000],
  synchronize: false,
  logging: nodeEnv === 'development',
});
