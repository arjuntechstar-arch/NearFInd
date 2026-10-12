import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const AUTH_TOKEN_VERIFIER = Symbol('AUTH_TOKEN_VERIFIER');

export interface VerifiedIdentity {
  issuer: string;
  subject: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}

@Injectable()
export class OidcTokenVerifier implements TokenVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwksUrl: URL;
  private readonly algorithms: string[];
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.issuer = config.getOrThrow<string>('OIDC_ISSUER_URL');
    this.audience = config.getOrThrow<string>('OIDC_AUDIENCE');
    this.jwksUrl = new URL(config.getOrThrow<string>('OIDC_JWKS_URL'));
    this.algorithms = config.get<string>('OIDC_ALLOWED_ALGORITHMS', 'RS256')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    this.jwks = createRemoteJWKSet(this.jwksUrl, {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: this.algorithms,
        clockTolerance: 5,
      });
      return this.toIdentity(payload);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private toIdentity(payload: JWTPayload): VerifiedIdentity {
    if (!payload.iss || !payload.sub) {
      throw new UnauthorizedException('Token is missing required identity claims');
    }
    return {
      issuer: payload.iss,
      subject: payload.sub,
      displayName: typeof payload.name === 'string' ? payload.name : null,
      email: typeof payload.email === 'string' ? payload.email : null,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }
}
