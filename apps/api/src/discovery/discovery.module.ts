import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryService } from './discovery.service.js';
import { ExternalPlacesService } from './external-places.service.js';
import { OverpassPlacesProvider } from './overpass-places.provider.js';
import { ServiceCategory } from './entities/service-category.entity.js';
import { ServiceLocation } from './entities/service-location.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCategory, ServiceLocation])],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, ExternalPlacesService, OverpassPlacesProvider],
})
export class DiscoveryModule {}
