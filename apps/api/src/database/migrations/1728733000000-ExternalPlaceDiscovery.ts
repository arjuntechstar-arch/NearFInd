import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExternalPlaceDiscovery1728733000000 implements MigrationInterface {
  name = 'ExternalPlaceDiscovery1728733000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE service_locations
        ADD COLUMN source_provider varchar(40) NOT NULL DEFAULT 'nearfind',
        ADD COLUMN source_external_id varchar(180),
        ADD COLUMN source_attribution varchar(180),
        ADD COLUMN source_last_seen_at timestamptz,
        ADD COLUMN source_expires_at timestamptz
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_service_locations_external_source
      ON service_locations(source_provider, source_external_id)
      WHERE source_external_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX ix_service_locations_source_expiry
      ON service_locations(source_provider, source_expires_at)
      WHERE source_provider <> 'nearfind'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ix_service_locations_source_expiry');
    await queryRunner.query('DROP INDEX IF EXISTS uq_service_locations_external_source');
    await queryRunner.query(`
      ALTER TABLE service_locations
        DROP COLUMN IF EXISTS source_expires_at,
        DROP COLUMN IF EXISTS source_last_seen_at,
        DROP COLUMN IF EXISTS source_attribution,
        DROP COLUMN IF EXISTS source_external_id,
        DROP COLUMN IF EXISTS source_provider
    `);
  }
}
