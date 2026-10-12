import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns a liveness response', () => {
    const response = controller.live();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
    assert.equal(Number.isNaN(Date.parse(response.timestamp)), false);
  });

  it('returns a readiness response after bootstrap', () => {
    const response = controller.ready();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'nearfind-api');
  });
});
