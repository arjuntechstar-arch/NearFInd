import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { AuthGuard } from './auth/auth.guard.js';
import { DevAuthController } from './auth/dev-auth.controller.js';
import { DevAuthService } from './auth/dev-auth.service.js';
import { LocalOrOidcTokenVerifier } from './auth/local-or-oidc-token-verifier.js';
import { RolesGuard } from './auth/roles.js';
import { AUTH_TOKEN_VERIFIER, OidcTokenVerifier } from './auth/token-verifier.js';
import { Favorite } from './entities/favorite.entity.js';
import { User } from './entities/user.entity.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Favorite, ServiceLocation])],
  controllers: [IdentityController, DevAuthController],
  providers: [
    IdentityService,
    AuthGuard,
    RolesGuard,
    OidcTokenVerifier,
    DevAuthService,
    LocalOrOidcTokenVerifier,
    { provide: AUTH_TOKEN_VERIFIER, useExisting: LocalOrOidcTokenVerifier },
  ],
  exports: [IdentityService, AuthGuard, RolesGuard, AUTH_TOKEN_VERIFIER],
})
export class IdentityModule {}
