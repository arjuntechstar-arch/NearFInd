import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { IdentityService } from '../identity.service.js';
import { AUTH_TOKEN_VERIFIER, type TokenVerifier } from './token-verifier.js';

const BEARER_PREFIX = 'Bearer ';
const MAX_BEARER_TOKEN_LENGTH = 8192;

export interface AuthenticatedRequest extends FastifyRequest {
  currentUser?: Awaited<ReturnType<IdentityService['resolveUser']>>;
}

function extractBearerToken(authorization: string | undefined): string {
  if (!authorization) throw new UnauthorizedException('Bearer token required');

  if (authorization.length <= BEARER_PREFIX.length || authorization.length > BEARER_PREFIX.length + MAX_BEARER_TOKEN_LENGTH) {
    throw new UnauthorizedException('Bearer token required');
  }

  if (authorization.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX.toLowerCase()) {
    throw new UnauthorizedException('Bearer token required');
  }

  const token = authorization.slice(BEARER_PREFIX.length);
  if (token.trim() !== token || token.includes(' ') || token.includes('\t') || token.includes('\r') || token.includes('\n')) {
    throw new UnauthorizedException('Bearer token required');
  }

  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IdentityService) private readonly identityService: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    const identity = await this.verifier.verify(token);
    request.currentUser = await this.identityService.resolveUser(identity);
    return true;
  }
}
