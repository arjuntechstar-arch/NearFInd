import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { IdentityService } from '../identity.service.js';
import { UserRole } from '../entities/user.entity.js';
import type { TokenVerifier, VerifiedIdentity } from './token-verifier.js';

export const DEV_TOKEN_PREFIX = 'nfdev.';
const DEV_ISSUER = 'nearfind://local-development';
const DEV_AUDIENCE = 'nearfind-api';
const DEV_TOKEN_SECONDS = 12 * 60 * 60;

@Injectable()
export class DevAuthService implements TokenVerifier {
  private readonly signingKey = randomBytes(32);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('NODE_ENV') === 'development' && this.config.get<string>('DEV_AUTH_ENABLED', 'true') !== 'false';
  }

  async issue(role: UserRole): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresIn: number; role: UserRole }> {
    this.assertEnabled();
    const roleName = role.toLowerCase();
    const identity: VerifiedIdentity = {
      issuer: DEV_ISSUER,
      subject: `local-${roleName}`,
      displayName: `NearFind Local ${roleName.charAt(0).toUpperCase()}${roleName.slice(1)}`,
      email: `${roleName}@nearfind.local`,
      avatarUrl: null,
    };
    await this.identity.ensureDevelopmentUser(identity, role);

    const jwt = await new SignJWT({ name: identity.displayName, email: identity.email })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(identity.issuer)
      .setAudience(DEV_AUDIENCE)
      .setSubject(identity.subject)
      .setIssuedAt()
      .setExpirationTime(`${DEV_TOKEN_SECONDS}s`)
      .sign(this.signingKey);

    return { accessToken: `${DEV_TOKEN_PREFIX}${jwt}`, tokenType: 'Bearer', expiresIn: DEV_TOKEN_SECONDS, role };
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    this.assertEnabled();
    if (!token.startsWith(DEV_TOKEN_PREFIX)) throw new UnauthorizedException('Invalid development access token');

    try {
      const { payload } = await jwtVerify(token.slice(DEV_TOKEN_PREFIX.length), this.signingKey, {
        issuer: DEV_ISSUER,
        audience: DEV_AUDIENCE,
        algorithms: ['HS256'],
        clockTolerance: 5,
      });
      if (!payload.iss || !payload.sub) throw new UnauthorizedException('Development token is missing identity claims');
      return {
        issuer: payload.iss,
        subject: payload.sub,
        displayName: typeof payload.name === 'string' ? payload.name : null,
        email: typeof payload.email === 'string' ? payload.email : null,
        avatarUrl: null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired development access token');
    }
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) throw new ForbiddenException('Local development authentication is disabled');
  }
}
