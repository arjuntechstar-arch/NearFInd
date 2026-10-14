import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

for (const envFile of [new URL('../../.env.local', import.meta.url), new URL('../../.env', import.meta.url)]) {
  try {
    loadEnvFile(fileURLToPath(envFile));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  headers() {
    return Promise.resolve([
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]);
  },
};

export default nextConfig;
