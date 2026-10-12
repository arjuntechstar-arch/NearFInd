import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
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
import { requireCurrentUser } from './http.js';
import { IntelligenceService } from './intelligence.service.js';

class FuelObservationDto {
  @IsUUID('4') serviceLocationId!: string;
  @IsString() @MinLength(2) @MaxLength(40) fuelType!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000) price!: number;
  @IsString() @Length(3, 3) currency = 'INR';
  @IsOptional() @IsDateString() observedAt?: string;
}

class EvConnectorDto {
  @IsUUID('4') serviceLocationId!: string;
  @IsString() @MinLength(2) @MaxLength(60) connectorType!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(5000) powerKw!: number;
  @IsString() @MinLength(2) @MaxLength(30) status!: string;
}

class RouteOptimizeDto {
  @Type(() => Number) @IsLatitude() startLat!: number;
  @Type(() => Number) @IsLongitude() startLng!: number;
  @Type(() => Number) @IsLatitude() endLat!: number;
  @Type(() => Number) @IsLongitude() endLng!: number;
  @Type(() => Number) @IsInt() @Min(500) @Max(25000) corridorMeters = 5000;
  @IsOptional() @IsUUID('4') categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) fuelType?: string | null;
}

@Controller()
export class IntelligenceController {
  constructor(@Inject(IntelligenceService) private readonly intelligence: IntelligenceService) {}

  @Post('fuel-observations')
  @UseGuards(AuthGuard)
  addFuel(@Req() request: AuthenticatedRequest, @Body() body: FuelObservationDto) {
    return this.intelligence.addFuelObservation(requireCurrentUser(request), {
      serviceLocationId: body.serviceLocationId,
      fuelType: body.fuelType,
      price: body.price,
      currency: body.currency,
      ...(body.observedAt ? { observedAt: new Date(body.observedAt) } : {}),
    });
  }

  @Get('fuel-observations')
  fuelObservations(
    @Query('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
    @Query('fuelType') fuelType?: string,
  ) {
    return this.intelligence.listFuelObservations(placeId, fuelType);
  }

  @Post('ev-connectors')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  upsertConnector(@Req() request: AuthenticatedRequest, @Body() body: EvConnectorDto) {
    return this.intelligence.upsertEvConnector(requireCurrentUser(request), body);
  }

  @Get('ev-connectors/:placeId')
  connectors(@Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string) {
    return this.intelligence.listEvConnectors(placeId);
  }

  @Post('route-optimizations')
  @UseGuards(AuthGuard)
  optimize(@Req() request: AuthenticatedRequest, @Body() body: RouteOptimizeDto) {
    return this.intelligence.optimizeRoute(requireCurrentUser(request), {
      start: { lat: body.startLat, lng: body.startLng },
      end: { lat: body.endLat, lng: body.endLng },
      corridorMeters: body.corridorMeters,
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.fuelType !== undefined ? { fuelType: body.fuelType } : {}),
    });
  }

  @Get('route-sessions')
  @UseGuards(AuthGuard)
  routeSessions(@Req() request: AuthenticatedRequest) {
    return this.intelligence.listRouteSessions(requireCurrentUser(request).id);
  }
}
