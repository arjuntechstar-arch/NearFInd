import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error('BASE_URL is required');

export default function () {
  const health = http.get(`${BASE_URL}/health/ready`);
  check(health, { 'health status is 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(0.5);
}
