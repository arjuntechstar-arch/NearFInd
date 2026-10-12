import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller.js';

void describe('HealthController', () => {
  void it('returns a liveness response', () => {
    const dataSource = { query: async () => [{ '?column?': 1 }] } as unknown as DataSource;
    const controller = new HealthController(dataSource);
    const response = controller.live();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
    assert.equal(Number.isNaN(Date.parse(response.timestamp)), false);
  });

  void it('returns ready when database responds', async () => {
    const dataSource = { query: async () => [{ '?column?': 1 }] } as unknown as DataSource;
    const controller = new HealthController(dataSource);
    const response = await controller.ready();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
  });

  void it('returns unavailable when database query fails', async () => {
    const dataSource = {
      query: async () => {
        throw new Error('offline');
      },
    } as unknown as DataSource;
    const controller = new HealthController(dataSource);
    await assert.rejects(() => controller.ready(), ServiceUnavailableException);
  });
});
