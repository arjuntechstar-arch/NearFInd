import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

void describe('Health API (e2e)', () => {
  let app: NestFastifyApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  after(async () => {
    await app.close();
  });

  void it('GET /v1/health/ready returns ready', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/health/ready',
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ status: string; service: string }>();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'nearfind-api');
  });
});
