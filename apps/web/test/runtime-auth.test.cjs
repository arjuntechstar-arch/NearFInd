const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const serverAuth = fs.readFileSync(path.join(appRoot, 'lib', 'server-auth.ts'), 'utf8');
const loginRoute = fs.readFileSync(path.join(appRoot, 'app', 'auth', 'login', 'route.ts'), 'utf8');
const devLoginPage = fs.readFileSync(path.join(appRoot, 'app', 'dev-login', 'page.tsx'), 'utf8');

test('local web auth is development/test only and can be explicitly disabled', () => {
  assert.match(serverAuth, /nodeEnv === 'development' \|\| nodeEnv === 'test'/);
  assert.match(serverAuth, /LOCAL_DEV_AUTH !== 'false'/);
  assert.match(loginRoute, /isLocalDevAuthEnabled\(\)/);
  assert.match(loginRoute, /setAccessTokenCookie/);
});

test('same-origin protection no longer depends on OIDC configuration', () => {
  assert.match(serverAuth, /new URL\(getWebBaseUrl\(\)\)\.origin/);
  assert.doesNotMatch(serverAuth, /function assertSameOrigin[\s\S]*getWebAuthConfig\(\)/);
});

test('developer role switcher exposes user provider and admin flows only outside production', () => {
  assert.match(devLoginPage, /process\.env\.NODE_ENV === 'production'/);
  for (const role of ['USER', 'PROVIDER', 'ADMIN']) assert.ok(devLoginPage.includes(`role=${role}`));
});
