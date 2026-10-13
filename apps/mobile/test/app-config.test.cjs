const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../app.json');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
const authSource = fs.readFileSync(path.join(__dirname, '..', 'auth.ts'), 'utf8');
const hubSource = fs.readFileSync(path.join(__dirname, '..', 'PlatformHub.tsx'), 'utf8');

test('mobile bundle identifiers are production-safe and explicit', () => {
  assert.equal(config.expo.ios.bundleIdentifier, 'com.nearfind.app');
  assert.equal(config.expo.android.package, 'com.nearfind.app');
});

test('location permission explains user benefit', () => {
  const message = config.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription;
  assert.match(message, /location/i);
  assert.match(message, /nearby services/i);
});

test('mobile app requests only foreground location at foundation stage', () => {
  assert.deepEqual(config.expo.android.permissions, [
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
  ]);
});

test('mobile OIDC uses the registered NearFind redirect scheme and PKCE', () => {
  assert.equal(config.expo.scheme, 'nearfind');
  assert.match(appSource, /scheme:\s*['"]nearfind['"]/);
  assert.match(appSource, /responseType:\s*AuthSession\.ResponseType\.Code/);
  assert.match(appSource, /usePKCE:\s*true/);
  assert.match(appSource, /code_verifier/);
});

test('mobile tokens use SecureStore without embedded client secrets or plaintext storage', () => {
  assert.ok(config.expo.plugins.includes('expo-secure-store'));
  assert.match(authSource, /expo-secure-store/);
  assert.match(authSource, /SecureStore\.setItemAsync/);
  assert.match(authSource, /SecureStore\.getItemAsync/);
  assert.doesNotMatch(`${appSource}\n${authSource}\n${hubSource}`, /clientSecret|client_secret/);
  assert.doesNotMatch(`${appSource}\n${authSource}\n${hubSource}`, /AsyncStorage|localStorage|sessionStorage/);
});

test('mobile journey hub covers authenticated Phase 2-7 user workflows', () => {
  assert.match(appSource, /PlatformHub/);
  for (const endpoint of [
    '/contributions',
    '/notifications',
    '/route-optimizations',
    '/bookings',
    '/dispatch-requests',
    '/rewards/wallet',
    '/rewards/challenges',
    '/rewards/perks',
    '/feature-flags/property_module',
    '/properties',
  ]) {
    assert.ok(hubSource.includes(endpoint), `Expected journey hub endpoint ${endpoint}`);
  }
});

test('mobile roadside messaging keeps public emergency services explicitly separate', () => {
  assert.match(hubSource, /private roadside assistance/i);
  assert.match(hubSource, /does not contact or replace public emergency services/i);
  assert.match(appSource, /separate from private roadside assistance/i);
});
