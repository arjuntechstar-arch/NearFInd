const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');

test('web foundation includes required security headers', () => {
  const config = fs.readFileSync(path.join(appRoot, 'next.config.ts'), 'utf8');
  for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.match(config, new RegExp(header));
  }
});

test('explore page keeps primary accessibility semantics', () => {
  const page = fs.readFileSync(path.join(appRoot, 'app', 'page.tsx'), 'utf8');
  assert.match(page, /role="search"/);
  assert.match(page, /aria-label="Primary navigation"/);
  assert.match(page, /aria-labelledby="nearby-title"/);
});

test('location updates load every nearby page before applying client-side filters', () => {
  const page = fs.readFileSync(path.join(appRoot, 'app', 'page.tsx'), 'utf8');
  const nearby = fs.readFileSync(path.join(appRoot, 'lib', 'nearby-client.ts'), 'utf8');
  assert.match(page, /navigator\.geolocation\.watchPosition/);
  assert.match(page, /fetchAllNearbyServices/);
  assert.match(page, /service\.category\.slug !== activeCategory/);
  assert.match(nearby, /limit:\s*String\(PAGE_SIZE\)/);
  assert.match(nearby, /offset:\s*String\(offset\)/);
  assert.doesNotMatch(nearby, /category/);
});

test('global styles retain visible keyboard focus and reduced motion support', () => {
  const css = fs.readFileSync(path.join(appRoot, 'app', 'globals.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
