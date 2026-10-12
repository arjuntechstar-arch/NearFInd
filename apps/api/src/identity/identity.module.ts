import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { AuthGuard } from './auth/auth.guard.js';
import { RolesGuard } from './auth/roles.js';
import { AUTH_TOKEN_VERIFIER, OidcTokenVerifier } from './auth/token-verifier.js';
import { Favorite } from './entities/favorite.entity.js';
import { User } from './entities/user.entity.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Favorite, ServiceLocation])],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    AuthGuard,
    RolesGuard,
    OidcTokenVerifier,
    { provide: AUTH_TOKEN_VERIFIER, useExisting: OidcTokenVerifier },
  ],
  exports: [IdentityService, AuthGuard, RolesGuard, AUTH_TOKEN_VERIFIER],
})
export class IdentityModule {}
