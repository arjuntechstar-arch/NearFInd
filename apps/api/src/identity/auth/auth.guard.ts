import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { IdentityService } from '../identity.service.js';
import { AUTH_TOKEN_VERIFIER, type TokenVerifier } from './token-verifier.js';

export interface AuthenticatedRequest extends FastifyRequest {
  currentUser?: Awaited<ReturnType<IdentityService['resolveUser']>>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IdentityService) private readonly identityService: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) throw new UnauthorizedException('Bearer token required');

    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match?.[1]) throw new UnauthorizedException('Bearer token required');

    const identity = await this.verifier.verify(match[1]);
    request.currentUser = await this.identityService.resolveUser(identity);
    return true;
  }
}
