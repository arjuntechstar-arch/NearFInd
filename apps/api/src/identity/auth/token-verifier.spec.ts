import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { LOCAL_DEV_ISSUER, OidcTokenVerifier } from './token-verifier.js';

void describe('OidcTokenVerifier local development identities', () => {
  void it('accepts explicit local roles in development/test only', async () => {
    const verifier = new OidcTokenVerifier(new ConfigService({ NODE_ENV: 'test' }));

    const user = await verifier.verify('nearfind-dev.USER');
    const provider = await verifier.verify('nearfind-dev.PROVIDER');
    const admin = await verifier.verify('nearfind-dev.ADMIN');

    assert.equal(user.issuer, LOCAL_DEV_ISSUER);
    assert.equal(user.subject, 'local-user');
    assert.equal(provider.subject, 'local-provider');
    assert.equal(admin.subject, 'local-admin');
  });

  void it('never accepts local development tokens in production', async () => {
    const verifier = new OidcTokenVerifier(new ConfigService({ NODE_ENV: 'production' }));
    await assert.rejects(() => verifier.verify('nearfind-dev.ADMIN'), /OIDC authentication is not configured/);
  });
});
