import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  role: 'USER' | 'PROVIDER' | 'ADMIN';
}

void describe('Local runtime authentication (e2e)', () => {
  let app: NestFastifyApplication;

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_ENABLED = 'true';
    process.env.EXTERNAL_PLACES_PROVIDER = 'none';
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  after(async () => {
    await app.close();
  });

  for (const role of ['USER', 'PROVIDER', 'ADMIN'] as const) {
    void it(`issues a ${role} session that can access /me`, async () => {
      const login = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/v1/dev-auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { role },
      });
      assert.equal(login.statusCode, 201);
      const session = login.json<LoginResponse>();
      assert.equal(session.role, role);
      assert.ok(session.accessToken.startsWith('nfdev.'));
      assert.ok(session.expiresIn > 0);

      const me = await app.getHttpAdapter().getInstance().inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      assert.equal(me.statusCode, 200);
      const profile = me.json<{ role: string; email: string | null }>();
      assert.equal(profile.role, role);
      assert.equal(profile.email, `${role.toLowerCase()}@nearfind.local`);
    });
  }
});
