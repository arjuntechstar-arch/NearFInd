import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const AUTH_TOKEN_VERIFIER = Symbol('AUTH_TOKEN_VERIFIER');

const asymmetricAlgorithms = new Set([
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
]);

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
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async verify(token: string): Promise<VerifiedIdentity> {
    const issuer = this.config.get<string>('OIDC_ISSUER_URL');
    const audience = this.config.get<string>('OIDC_AUDIENCE');
    const jwksUrl = this.config.get<string>('OIDC_JWKS_URL');
    if (!issuer || !audience || !jwksUrl) {
      throw new UnauthorizedException('OIDC authentication is not configured');
    }

    const algorithms = this.config
      .get<string>('OIDC_ALLOWED_ALGORITHMS', 'RS256')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (algorithms.length === 0 || algorithms.some((algorithm) => !asymmetricAlgorithms.has(algorithm))) {
      throw new UnauthorizedException('OIDC signature algorithm configuration is invalid');
    }

    this.jwks ??= createRemoteJWKSet(new URL(jwksUrl), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer,
        audience,
        algorithms,
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
