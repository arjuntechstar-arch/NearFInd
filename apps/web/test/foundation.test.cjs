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

test('global styles retain visible keyboard focus and reduced motion support', () => {
  const css = fs.readFileSync(path.join(appRoot, 'app', 'globals.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
