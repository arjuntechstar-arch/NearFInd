import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentityAndFavorites1728731000000 implements MigrationInterface {
  name = 'IdentityAndFavorites1728731000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('USER', 'PROVIDER', 'ADMIN')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "issuer" varchar(500) NOT NULL,
        "subject" varchar(255) NOT NULL,
        "display_name" varchar(160),
        "email" varchar(320),
        "avatar_url" varchar(2048),
        "role" "user_role" NOT NULL DEFAULT 'USER',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_issuer_subject" UNIQUE ("issuer", "subject")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "user_id" uuid NOT NULL,
        "service_location_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_favorites" PRIMARY KEY ("user_id", "service_location_id"),
        CONSTRAINT "fk_favorites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_favorites_service_location" FOREIGN KEY ("service_location_id") REFERENCES "service_locations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_favorites_service_location" ON "favorites" ("service_location_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "favorites"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
