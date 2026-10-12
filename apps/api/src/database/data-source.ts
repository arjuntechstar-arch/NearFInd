import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ServiceCategory } from '../discovery/entities/service-category.entity.js';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { InitialDiscoverySchema1728730000000 } from './migrations/1728730000000-InitialDiscoverySchema.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://nearfind:nearfind_local@localhost:5432/nearfind';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [ServiceCategory, ServiceLocation],
  migrations: [InitialDiscoverySchema1728730000000],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
