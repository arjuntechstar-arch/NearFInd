import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

interface NearbyResult {
  id: string;
  name: string;
  category: { slug: string };
  distanceMeters: number;
  sourceProvider: string;
  sourceAttribution: string | null;
}

void describe('Discovery API (e2e)', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    dataSource = app.get(DataSource);
  });

  after(async () => {
    await app.close();
  });

  void it('returns seeded categories', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/categories',
    });

    assert.equal(response.statusCode, 200);
    const categories = response.json<Array<{ slug: string }>>();
    assert.ok(categories.some((category) => category.slug === 'fuel'));
    assert.ok(categories.some((category) => category.slug === 'hospital'));
  });

  void it('returns nearby places ordered by distance', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=20',
    });

    assert.equal(response.statusCode, 200);
    const places = response.json<NearbyResult[]>();
    assert.ok(places.length >= 3);
    assert.equal(places[0]?.name, 'NearFind Demo Fuel Central');
    assert.equal(places[0]?.sourceProvider, 'nearfind');

    for (let index = 1; index < places.length; index += 1) {
      assert.ok(places[index - 1]!.distanceMeters <= places[index]!.distanceMeters);
    }
  });

  void it('supports deterministic pagination so clients can load every nearby service', async () => {
    const firstResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=2&offset=0',
    });
    const secondResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=2&offset=2',
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 200);
    const firstPage = firstResponse.json<NearbyResult[]>();
    const secondPage = secondResponse.json<NearbyResult[]>();
    assert.equal(firstPage.length, 2);
    assert.ok(secondPage.length >= 1);
    assert.equal(new Set([...firstPage, ...secondPage].map((place) => place.id)).size, firstPage.length + secondPage.length);
    assert.ok(firstPage.at(-1)!.distanceMeters <= secondPage[0]!.distanceMeters);
  });

  void it('filters nearby places by category', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&category=hospital',
    });

    assert.equal(response.statusCode, 200);
    const places = response.json<NearbyResult[]>();
    assert.ok(places.length >= 1);
    assert.ok(places.every((place) => place.category.slug === 'hospital'));
  });

  void it('shows fresh external places nearby, hides them after expiry, and keeps detail references valid', async () => {
    const externalId = 'node/test-nearfind-external';
    const inserted = await dataSource.query<Array<{ id: string }>>(
      `
        INSERT INTO service_locations (
          category_id, name, address, city, state, country_code, location,
          rating, review_count, is_active, source_provider, source_external_id,
          source_attribution, source_last_seen_at, source_expires_at
        )
        SELECT
          id, 'NearFind External Test ATM', 'External test address', 'Chennai', 'Tamil Nadu', 'IN',
          ST_SetSRID(ST_MakePoint(80.2497, 13.0605), 4326)::geography,
          0, 0, true, 'openstreetmap', $1, '© OpenStreetMap contributors', now(), now() + interval '1 hour'
        FROM service_categories
        WHERE slug = 'atm'
        RETURNING id
      `,
      [externalId],
    );
    const placeId = inserted[0]?.id;
    assert.ok(placeId);

    try {
      const freshResponse = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=100',
      });
      assert.equal(freshResponse.statusCode, 200);
      const freshPlaces = freshResponse.json<NearbyResult[]>();
      const external = freshPlaces.find((place) => place.id === placeId);
      assert.ok(external);
      assert.equal(external.sourceProvider, 'openstreetmap');
      assert.equal(external.sourceAttribution, '© OpenStreetMap contributors');

      await dataSource.query(
        `UPDATE service_locations SET source_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [placeId],
      );

      const expiredResponse = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=100',
      });
      assert.equal(expiredResponse.statusCode, 200);
      assert.ok(!expiredResponse.json<NearbyResult[]>().some((place) => place.id === placeId));

      const detailResponse = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: `/v1/discovery/places/${placeId}`,
      });
      assert.equal(detailResponse.statusCode, 200);
      assert.equal(detailResponse.json<{ id: string; sourceProvider: string }>().sourceProvider, 'openstreetmap');
    } finally {
      await dataSource.query('DELETE FROM service_locations WHERE id = $1', [placeId]);
    }
  });

  void it('returns place detail for an active nearby result', async () => {
    const nearbyResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=1',
    });
    const [place] = nearbyResponse.json<NearbyResult[]>();
    assert.ok(place?.id);

    const detailResponse = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: `/v1/discovery/places/${place.id}`,
    });

    assert.equal(detailResponse.statusCode, 200);
    const detail = detailResponse.json<{ id: string; coordinates: { lat: number; lng: number } }>();
    assert.equal(detail.id, place.id);
    assert.equal(typeof detail.coordinates.lat, 'number');
    assert.equal(typeof detail.coordinates.lng, 'number');
  });

  void it('rejects invalid nearby coordinates', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=200&lng=80.2496',
    });

    assert.equal(response.statusCode, 400);
  });
});
