import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

interface NearbyResult {
  id: string;
  name: string;
  category: { slug: string };
  distanceMeters: number;
}

void describe('Discovery API (e2e)', () => {
  let app: NestFastifyApplication;

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

    for (let index = 1; index < places.length; index += 1) {
      assert.ok(places[index - 1]!.distanceMeters <= places[index]!.distanceMeters);
    }
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
