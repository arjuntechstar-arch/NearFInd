import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
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
import { BookingService } from './booking.service.js';
import { requireCurrentUser } from './http.js';

class SlotCreateDto {
  @IsUUID('4') providerId!: string;
  @IsUUID('4') serviceLocationId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) capacity = 1;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceMinor = 0;
  @IsString() @Length(3, 3) currency = 'INR';
}

class SlotUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) capacity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceMinor?: number;
}

class BookingCreateDto {
  @IsUUID('4') slotId!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

class PaymentAuthorizeDto {
  @IsString() @MinLength(16) @MaxLength(256) paymentMethodToken!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

@Controller()
export class BookingController {
  constructor(@Inject(BookingService) private readonly booking: BookingService) {}

  @Post('provider-slots')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  createSlot(@Req() request: AuthenticatedRequest, @Body() body: SlotCreateDto) {
    return this.booking.createSlot(requireCurrentUser(request), {
      providerId: body.providerId,
      serviceLocationId: body.serviceLocationId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      capacity: body.capacity,
      priceMinor: body.priceMinor,
      currency: body.currency,
    });
  }

  @Patch('provider-slots/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  updateSlot(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: SlotUpdateDto,
  ) {
    return this.booking.updateSlot(requireCurrentUser(request), id, body.version, {
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.priceMinor !== undefined ? { priceMinor: body.priceMinor } : {}),
    });
  }

  @Get('provider-slots')
  listSlots(@Query('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string) {
    return this.booking.listSlots(placeId);
  }

  @Post('bookings')
  @UseGuards(AuthGuard)
  reserve(@Req() request: AuthenticatedRequest, @Body() body: BookingCreateDto) {
    return this.booking.reserve(requireCurrentUser(request), body.slotId, body.idempotencyKey);
  }

  @Get('bookings')
  @UseGuards(AuthGuard)
  mine(@Req() request: AuthenticatedRequest) {
    return this.booking.listMyBookings(requireCurrentUser(request).id);
  }

  @Get('bookings/:id')
  @UseGuards(AuthGuard)
  getBooking(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.booking.getBooking(requireCurrentUser(request), id);
  }

  @Post('bookings/:id/authorize-payment')
  @UseGuards(AuthGuard)
  authorize(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: PaymentAuthorizeDto,
  ) {
    return this.booking.authorizeSandboxPayment(
      requireCurrentUser(request),
      id,
      body.paymentMethodToken,
      body.idempotencyKey,
    );
  }

  @Post('bookings/:id/cancel')
  @UseGuards(AuthGuard)
  cancel(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.booking.cancel(requireCurrentUser(request), id);
  }

  @Post('bookings/:id/complete')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  complete(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.booking.complete(requireCurrentUser(request), id);
  }

  @Get('bookings/:id/receipt')
  @UseGuards(AuthGuard)
  receipt(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.booking.receipt(requireCurrentUser(request), id);
  }

  @Get('provider/bookings')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  providerBookings(
    @Req() request: AuthenticatedRequest,
    @Query('providerId', new ParseUUIDPipe({ version: '4' })) providerId: string,
  ) {
    return this.booking.listProviderBookings(requireCurrentUser(request), providerId);
  }
}
