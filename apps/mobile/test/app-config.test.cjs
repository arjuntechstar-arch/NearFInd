const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../app.json');

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
