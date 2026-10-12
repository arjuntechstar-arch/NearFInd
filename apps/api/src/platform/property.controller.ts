import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { PropertyStatus } from './entities.js';
import { requireCurrentUser } from './http.js';
import { PropertyService } from './property.service.js';

class PropertyCreateDto {
  @IsOptional() @IsUUID('4') providerId?: string | null;
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsString() @MinLength(10) @MaxLength(5000) description!: string;
  @IsString() @MinLength(2) @MaxLength(255) address!: string;
  @IsString() @MinLength(1) @MaxLength(120) city!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) priceMinor!: number;
  @IsString() @Length(3, 3) currency = 'INR';
  @IsString() @MinLength(2) @MaxLength(50) propertyType!: string;
  @Type(() => Number) @IsLatitude() lat!: number;
  @Type(() => Number) @IsLongitude() lng!: number;
}

class PropertyUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) priceMinor?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) propertyType?: string;
}

class PropertyMediaDto {
  @IsString() @MinLength(10) @MaxLength(1024) objectKey!: string;
  @IsString() @MinLength(2) @MaxLength(30) mediaType!: string;
}

class InspectionDto {
  @IsDateString() scheduledAt!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

class ModerationDto {
  @IsString() status!: PropertyStatus;
}

@Controller()
export class PropertyController {
  constructor(@Inject(PropertyService) private readonly property: PropertyService) {}

  @Get('properties')
  list(
    @Query('city') city?: string,
    @Query('propertyType') propertyType?: string,
    @Query('minPriceMinor') minPriceMinor?: string,
    @Query('maxPriceMinor') maxPriceMinor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.property.listPublic({
      city,
      propertyType,
      minPriceMinor: minPriceMinor === undefined ? undefined : Number(minPriceMinor),
      maxPriceMinor: maxPriceMinor === undefined ? undefined : Number(maxPriceMinor),
      limit: Math.max(1, Math.min(50, Number(limit ?? 20) || 20)),
    });
  }

  @Get('properties/:id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.property.getPublic(id);
  }

  @Post('properties')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  create(@Req() request: AuthenticatedRequest, @Body() body: PropertyCreateDto) {
    return this.property.createListing(requireCurrentUser(request), body);
  }

  @Patch('properties/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: PropertyUpdateDto,
  ) {
    const { version, ...input } = body;
    return this.property.updateListing(requireCurrentUser(request), id, version, input);
  }

  @Post('properties/:id/media')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  media(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: PropertyMediaDto,
  ) {
    return this.property.addMedia(requireCurrentUser(request), id, body.objectKey, body.mediaType);
  }

  @Post('properties/:id/inspection-bookings')
  @UseGuards(AuthGuard)
  inspection(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: InspectionDto,
  ) {
    return this.property.bookInspection(requireCurrentUser(request), id, new Date(body.scheduledAt), body.idempotencyKey);
  }

  @Get('inspection-bookings')
  @UseGuards(AuthGuard)
  myInspections(@Req() request: AuthenticatedRequest) {
    return this.property.listMyInspections(requireCurrentUser(request).id);
  }

  @Get('provider/properties')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  providerListings(
    @Req() request: AuthenticatedRequest,
    @Query('providerId', new ParseUUIDPipe({ version: '4' })) providerId: string,
  ) {
    return this.property.listProviderListings(requireCurrentUser(request), providerId);
  }

  @Get('provider/property-inspections')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  providerInspections(
    @Req() request: AuthenticatedRequest,
    @Query('providerId', new ParseUUIDPipe({ version: '4' })) providerId: string,
  ) {
    return this.property.listProviderInspections(requireCurrentUser(request), providerId);
  }

  @Patch('admin/properties/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  moderate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ModerationDto,
  ) {
    return this.property.moderate(requireCurrentUser(request), id, body.status);
  }
}
