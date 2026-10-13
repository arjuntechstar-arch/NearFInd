import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from './auth/auth.guard.js';
import { IdentityService } from './identity.service.js';

@Controller()
@UseGuards(AuthGuard)
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.identity.toProfile(this.requireUser(request));
  }

  @Get('favorites')
  listFavorites(@Req() request: AuthenticatedRequest) {
    return this.identity.listFavorites(this.requireUser(request).id);
  }

  @Post('favorites/:placeId')
  addFavorite(
    @Req() request: AuthenticatedRequest,
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ) {
    return this.identity.addFavorite(this.requireUser(request).id, placeId);
  }

  @Delete('favorites/:placeId')
  removeFavorite(
    @Req() request: AuthenticatedRequest,
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
  ) {
    return this.identity.removeFavorite(this.requireUser(request).id, placeId);
  }

  private requireUser(request: AuthenticatedRequest) {
    if (!request.currentUser) throw new Error('Authentication guard did not resolve a user');
    return request.currentUser;
  }
}
