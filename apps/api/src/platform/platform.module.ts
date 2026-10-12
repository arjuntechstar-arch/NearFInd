import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCategory } from '../discovery/entities/service-category.entity.js';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { Favorite } from '../identity/entities/favorite.entity.js';
import { User } from '../identity/entities/user.entity.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AccessService } from './access.service.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { CommunityController } from './community.controller.js';
import { CommunityService } from './community.service.js';
import { PLATFORM_ENTITIES } from './entities.js';
import { FieldCryptoService } from './field-crypto.service.js';
import { IntelligenceController } from './intelligence.controller.js';
import { IntelligenceService } from './intelligence.service.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { PropertyController } from './property.controller.js';
import { PropertyService } from './property.service.js';
import { RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';
import { RoadsideController } from './roadside.controller.js';
import { RoadsideService } from './roadside.service.js';
import { DirectRouteProvider, ROUTE_PROVIDER } from './route-provider.js';
import { StorageService } from './storage.service.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([ServiceCategory, ServiceLocation, User, Favorite, ...PLATFORM_ENTITIES]),
  ],
  controllers: [
    AccountController,
    CommunityController,
    IntelligenceController,
    BookingController,
    RoadsideController,
    RewardsController,
    PropertyController,
    OperationsController,
  ],
  providers: [
    AccessService,
    FieldCryptoService,
    StorageService,
    AccountService,
    CommunityService,
    IntelligenceService,
    BookingService,
    RoadsideService,
    RewardsService,
    PropertyService,
    OperationsService,
    DirectRouteProvider,
    { provide: ROUTE_PROVIDER, useExisting: DirectRouteProvider },
  ],
})
export class PlatformModule {}
