import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service.js';
import { NearbyQueryDto } from './dto/nearby-query.dto.js';

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(@Inject(DiscoveryService) private readonly discovery: DiscoveryService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List active nearby-service categories' })
  listCategories() {
    return this.discovery.listCategories();
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find active services within a geospatial radius' })
  findNearby(@Query() query: NearbyQueryDto) {
    return this.discovery.findNearby(query);
  }

  @Get('places/:id')
  @ApiOperation({ summary: 'Get one active service location by id' })
  getPlace(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.discovery.getPlace(id);
  }
}
