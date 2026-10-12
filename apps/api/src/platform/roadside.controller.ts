import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { from, interval, map, Observable, startWith, switchMap } from 'rxjs';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { DispatchStatus } from './entities.js';
import { requireCurrentUser } from './http.js';
import { RoadsideService } from './roadside.service.js';

class DispatchCreateDto {
  @IsOptional() @IsUUID('4') vehicleId?: string | null;
  @IsString() @MinLength(2) @MaxLength(50) serviceType!: string;
  @Type(() => Number) @IsLatitude() lat!: number;
  @Type(() => Number) @IsLongitude() lng!: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

class AssignDto {
  @IsUUID('4') providerId!: string;
}

class StatusDto {
  @IsString() status!: DispatchStatus;
}

class LocationGrantDto {
  @Type(() => Number) @IsInt() @Min(5) @Max(60) ttlMinutes = 15;
}

class LiveLocationDto {
  @Type(() => Number) @IsLatitude() lat!: number;
  @Type(() => Number) @IsLongitude() lng!: number;
}

class ChatMessageDto {
  @IsOptional() @IsString() @MaxLength(4000) body?: string | null;
  @IsOptional() @IsString() @MaxLength(1024) attachmentObjectKey?: string | null;
}

@Controller()
export class RoadsideController {
  constructor(
    @Inject(RoadsideService) private readonly roadside: RoadsideService,
    private readonly config: ConfigService,
  ) {}

  @Get('emergency/config')
  emergencyConfig() {
    return {
      region: this.config.get<string>('EMERGENCY_REGION') ?? 'IN',
      emergencyNumber: this.config.get<string>('EMERGENCY_NUMBER') ?? '112',
      disclaimer: 'This direct emergency-call option is separate from NearFind private roadside assistance. NearFind does not claim to dispatch public emergency services.',
    };
  }

  @Post('dispatch-requests')
  @UseGuards(AuthGuard)
  create(@Req() request: AuthenticatedRequest, @Body() body: DispatchCreateDto) {
    return this.roadside.createRequest(requireCurrentUser(request), body);
  }

  @Get('dispatch-requests')
  @UseGuards(AuthGuard)
  mine(@Req() request: AuthenticatedRequest) {
    return this.roadside.listMine(requireCurrentUser(request));
  }

  @Get('dispatch-requests/:id')
  @UseGuards(AuthGuard)
  get(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roadside.getRequest(requireCurrentUser(request), id);
  }

  @Get('admin/dispatch-requests')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  queue(@Req() request: AuthenticatedRequest) {
    return this.roadside.listQueue(requireCurrentUser(request));
  }

  @Post('admin/dispatch-requests/:id/triage')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  triage(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roadside.triage(requireCurrentUser(request), id);
  }

  @Post('admin/dispatch-requests/:id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AssignDto,
  ) {
    return this.roadside.assign(requireCurrentUser(request), id, body.providerId);
  }

  @Patch('dispatch-requests/:id/status')
  @UseGuards(AuthGuard)
  status(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: StatusDto,
  ) {
    return this.roadside.updateStatus(requireCurrentUser(request), id, body.status);
  }

  @Post('dispatch-requests/:id/location-grants')
  @UseGuards(AuthGuard)
  createGrant(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: LocationGrantDto,
  ) {
    return this.roadside.createLocationGrant(requireCurrentUser(request), id, body.ttlMinutes);
  }

  @Patch('dispatch-requests/:id/location-grants/:grantId')
  @UseGuards(AuthGuard)
  updateLocation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('grantId', new ParseUUIDPipe({ version: '4' })) grantId: string,
    @Body() body: LiveLocationDto,
  ) {
    return this.roadside.updateLiveLocation(requireCurrentUser(request), id, grantId, body.lat, body.lng);
  }

  @Get('dispatch-requests/:id/live-location')
  @UseGuards(AuthGuard)
  liveLocation(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roadside.getLiveLocation(requireCurrentUser(request), id);
  }

  @Delete('dispatch-requests/:id/location-grants/:grantId')
  @UseGuards(AuthGuard)
  revokeGrant(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('grantId', new ParseUUIDPipe({ version: '4' })) grantId: string,
  ) {
    return this.roadside.revokeLocationGrant(requireCurrentUser(request), id, grantId);
  }

  @Post('dispatch-requests/:id/chat')
  @UseGuards(AuthGuard)
  sendMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ChatMessageDto,
  ) {
    return this.roadside.sendMessage(requireCurrentUser(request), id, body);
  }

  @Get('dispatch-requests/:id/chat')
  @UseGuards(AuthGuard)
  messages(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roadside.listMessages(requireCurrentUser(request), id);
  }

  @Get('dispatch-requests/:id/events')
  @UseGuards(AuthGuard)
  events(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roadside.listEvents(requireCurrentUser(request), id);
  }

  @Sse('dispatch-requests/:id/stream')
  @UseGuards(AuthGuard)
  stream(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Observable<MessageEvent> {
    const user = requireCurrentUser(request);
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.roadside.listEvents(user, id))),
      map((events) => ({ data: events })),
    );
  }
}
