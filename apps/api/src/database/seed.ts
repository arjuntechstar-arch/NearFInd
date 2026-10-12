import { AppDataSource } from './data-source.js';

const locations = [
  ['fuel', 'NearFind Demo Fuel Central', 'Anna Salai demo location', 13.0604, 80.2496, 4.4, 128],
  ['atm', 'NearFind Demo ATM Express', 'Teynampet demo location', 13.0418, 80.2501, 4.1, 74],
  ['hospital', 'NearFind Demo Emergency Care', 'Nungambakkam demo location', 13.0569, 80.2425, 4.7, 211],
  ['bank', 'NearFind Demo Bank', 'Thousand Lights demo location', 13.0601, 80.2541, 4.0, 56],
  ['mechanic', 'NearFind Demo Auto Care', 'Royapettah demo location', 13.0543, 80.2642, 4.5, 93],
  ['pharmacy', 'NearFind Demo Pharmacy', 'Alwarpet demo location', 13.0338, 80.2546, 4.6, 147],
] as const;

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  try {
    await AppDataSource.transaction(async (manager) => {
      for (const [slug, name, address, lat, lng, rating, reviewCount] of locations) {
        await manager.query(
          `
          INSERT INTO service_locations (
            category_id, name, address, city, state, country_code,
            location, rating, review_count, is_active
          )
          SELECT
            c.id,
            $2::varchar(180),
            $3::varchar(255),
            'Chennai',
            'Tamil Nadu',
            'IN',
            ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography,
            $6::numeric(3,2),
            $7::integer,
            true
          FROM service_categories c
          WHERE c.slug = $1::varchar(80)
            AND NOT EXISTS (
              SELECT 1
              FROM service_locations existing
              WHERE existing.name = $2::varchar(180)
            )
          `,
          [slug, name, address, lat, lng, rating, reviewCount],
        );
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Discovery seed failed', error);
  process.exitCode = 1;
});
