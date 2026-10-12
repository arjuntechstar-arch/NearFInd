import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import {
  AUTH_TOKEN_VERIFIER,
  type TokenVerifier,
  type VerifiedIdentity,
} from '../src/identity/auth/token-verifier.js';

const identities: Record<string, VerifiedIdentity> = {
  'user-a': {
    issuer: 'https://issuer.test.example',
    subject: 'subject-a',
    displayName: 'Test User A',
    email: 'a@example.test',
    avatarUrl: null,
  },
  'user-b': {
    issuer: 'https://issuer.test.example',
    subject: 'subject-b',
    displayName: 'Test User B',
    email: 'b@example.test',
    avatarUrl: null,
  },
};

const verifier: TokenVerifier = {
  verify: (token: string) => {
    const identity = identities[token];
    if (!identity) return Promise.reject(new UnauthorizedException('Invalid test token'));
    return Promise.resolve(identity);
  },
};

void describe('Identity and favorites API (e2e)', () => {
  let app: NestFastifyApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  after(async () => {
    await app.close();
  });

  void it('rejects requests without a bearer token', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/v1/me' });
    assert.equal(response.statusCode, 401);
  });

  void it('rejects invalid bearer tokens', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer invalid' },
    });
    assert.equal(response.statusCode, 401);
  });

  void it('creates a local profile without exposing issuer or subject', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer user-a' },
    });
    assert.equal(response.statusCode, 200);
    const profile = response.json<Record<string, unknown>>();
    assert.equal(profile.displayName, 'Test User A');
    assert.equal(profile.role, 'USER');
    assert.equal('issuer' in profile, false);
    assert.equal('subject' in profile, false);
  });

  void it('keeps favorites isolated to the authenticated user and is idempotent', async () => {
    const discovery = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/discovery/nearby?lat=13.0604&lng=80.2496&radiusMeters=5000&limit=1',
    });
    assert.equal(discovery.statusCode, 200);
    const [place] = discovery.json<Array<{ id: string }>>();
    assert.ok(place?.id);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const addResponse = (await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: `/v1/favorites/${place.id}`,
        headers: { authorization: 'Bearer user-a' },
      })) as { statusCode: number };
      assert.equal(addResponse.statusCode, 201);
    }

    const favoritesA = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/favorites',
      headers: { authorization: 'Bearer user-a' },
    });
    assert.equal(favoritesA.statusCode, 200);
    assert.equal(
      favoritesA.json<Array<{ placeId: string }>>().filter((favorite) => favorite.placeId === place.id).length,
      1,
    );

    const favoritesB = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/favorites',
      headers: { authorization: 'Bearer user-b' },
    });
    assert.equal(favoritesB.statusCode, 200);
    assert.equal(
      favoritesB.json<Array<{ placeId: string }>>().some((favorite) => favorite.placeId === place.id),
      false,
    );

    const remove = await app.getHttpAdapter().getInstance().inject({
      method: 'DELETE',
      url: `/v1/favorites/${place.id}`,
      headers: { authorization: 'Bearer user-a' },
    });
    assert.equal(remove.statusCode, 200);
  });
});
