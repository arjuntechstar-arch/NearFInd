import { Inject, Injectable } from '@nestjs/common';
import { DEV_TOKEN_PREFIX, DevAuthService } from './dev-auth.service.js';
import { OidcTokenVerifier, type TokenVerifier, type VerifiedIdentity } from './token-verifier.js';

@Injectable()
export class LocalOrOidcTokenVerifier implements TokenVerifier {
  constructor(
    @Inject(DevAuthService) private readonly development: DevAuthService,
    @Inject(OidcTokenVerifier) private readonly oidc: OidcTokenVerifier,
  ) {}

  verify(token: string): Promise<VerifiedIdentity> {
    return token.startsWith(DEV_TOKEN_PREFIX) ? this.development.verify(token) : this.oidc.verify(token);
  }
}
