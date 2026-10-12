import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthController } from './health.controller.js';

void describe('HealthController', () => {
  const controller = new HealthController();

  void it('returns a liveness response', () => {
    const response = controller.live();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
    assert.equal(Number.isNaN(Date.parse(response.timestamp)), false);
  });

  void it('returns a readiness response after bootstrap', () => {
    const response = controller.ready();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
  });
});
