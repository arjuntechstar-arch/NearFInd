import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialDiscoverySchema1728730000000 implements MigrationInterface {
  name = 'InitialDiscoverySchema1728730000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      CREATE TABLE service_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(80) NOT NULL UNIQUE,
        name varchar(120) NOT NULL,
        icon varchar(32) NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE service_locations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
        name varchar(180) NOT NULL,
        address varchar(255) NOT NULL,
        city varchar(120) NOT NULL,
        state varchar(120) NOT NULL,
        country_code varchar(2) NOT NULL DEFAULT 'IN',
        location geography(Point, 4326) NOT NULL,
        rating numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
        review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
        is_active boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query('CREATE INDEX idx_service_locations_category ON service_locations(category_id)');
    await queryRunner.query('CREATE INDEX idx_service_locations_geo ON service_locations USING GIST(location)');
    await queryRunner.query('CREATE INDEX idx_service_locations_active ON service_locations(is_active) WHERE is_active = true');

    await queryRunner.query(`
      INSERT INTO service_categories (slug, name, icon, sort_order) VALUES
        ('fuel', 'Petrol & EV', 'fuel', 10),
        ('atm', 'ATMs', 'atm', 20),
        ('hospital', 'Emergency Care', 'hospital', 30),
        ('bank', 'Banks', 'bank', 40),
        ('mechanic', 'Mechanics', 'mechanic', 50),
        ('pharmacy', 'Pharmacies', 'pharmacy', 60)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS service_locations');
    await queryRunner.query('DROP TABLE IF EXISTS service_categories');
  }
}
