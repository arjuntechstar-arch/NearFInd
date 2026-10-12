import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns a liveness response', () => {
    const response = controller.live();
    expect(response.status).toBe('ok');
    expect(response.service).toBe('nearfind-api');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('returns a readiness response after bootstrap', () => {
    const response = controller.ready();
    expect(response.status).toBe('ok');
    expect(response.service).toBe('nearfind-api');
  });
});
