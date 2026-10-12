import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import type { User } from '../identity/entities/user.entity.js';

export function requireCurrentUser(request: AuthenticatedRequest): User {
  if (!request.currentUser) throw new UnauthorizedException('Authenticated user is unavailable');
  return request.currentUser;
}
