import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { AccountService } from './account.service.js';
import { ProviderStatus } from './entities.js';
import { requireCurrentUser } from './http.js';

class PreferenceDto {
  @IsOptional() @IsString() @MaxLength(160) manualLocationLabel?: string | null;
  @IsOptional() @Type(() => Number) @IsLatitude() manualLat?: number | null;
  @IsOptional() @Type(() => Number) @IsLongitude() manualLng?: number | null;
  @IsOptional() @IsBoolean() notificationPush?: boolean;
  @IsOptional() @IsBoolean() notificationEmail?: boolean;
  @IsOptional() @IsBoolean() leaderboardOptIn?: boolean;
}

class VehicleDto {
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
  @IsString() @MinLength(1) @MaxLength(40) vehicleType!: string;
  @IsOptional() @IsString() @MaxLength(40) fuelType?: string | null;
  @IsOptional() @IsString() @Length(4, 4) registrationLast4?: string | null;
  @IsOptional() @IsBoolean() isDefault = false;
}

class EmergencyContactDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) relationship?: string | null;
  @IsPhoneNumber() phone!: string;
}

class ProviderDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsPhoneNumber() supportPhone?: string | null;
}

class ProviderStatusDto {
  @IsEnum(ProviderStatus) status!: ProviderStatus;
}

class ProviderLocationDto {
  @IsUUID('4') providerId!: string;
  @IsUUID('4') categoryId!: string;
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsString() @MinLength(2) @MaxLength(255) address!: string;
  @IsString() @MinLength(1) @MaxLength(120) city!: string;
  @IsString() @MinLength(1) @MaxLength(120) state!: string;
  @IsString() @Length(2, 2) countryCode = 'IN';
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @ValidateIf((_, value: unknown) => value !== null) @IsUrl({ require_protocol: true }) websiteUrl?: string | null;
  @Type(() => Number) @IsLatitude() lat!: number;
  @Type(() => Number) @IsLongitude() lng!: number;
}

class ProviderLocationUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsUUID('4') categoryId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @ValidateIf((_, value: unknown) => value !== null) @IsUrl({ require_protocol: true }) websiteUrl?: string | null;
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
}

class CategoryCreateDto {
  @IsString() @MinLength(2) @MaxLength(80) slug!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) @MaxLength(32) icon!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10000) sortOrder = 0;
}

class CategoryUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(32) icon?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller()
@UseGuards(AuthGuard)
export class AccountController {
  constructor(@Inject(AccountService) private readonly account: AccountService) {}

  @Get('account/preferences')
  getPreferences(@Req() request: AuthenticatedRequest) {
    return this.account.getPreferences(requireCurrentUser(request).id);
  }

  @Patch('account/preferences')
  updatePreferences(@Req() request: AuthenticatedRequest, @Body() body: PreferenceDto) {
    return this.account.updatePreferences(requireCurrentUser(request).id, body);
  }

  @Get('account/vehicles')
  listVehicles(@Req() request: AuthenticatedRequest) {
    return this.account.listVehicles(requireCurrentUser(request).id);
  }

  @Post('account/vehicles')
  addVehicle(@Req() request: AuthenticatedRequest, @Body() body: VehicleDto) {
    return this.account.addVehicle(requireCurrentUser(request).id, {
      label: body.label,
      vehicleType: body.vehicleType,
      fuelType: body.fuelType ?? null,
      registrationLast4: body.registrationLast4 ?? null,
      isDefault: body.isDefault,
    });
  }

  @Delete('account/vehicles/:id')
  removeVehicle(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.account.removeVehicle(requireCurrentUser(request).id, id);
  }

  @Get('account/emergency-contacts')
  listContacts(@Req() request: AuthenticatedRequest) {
    return this.account.listEmergencyContacts(requireCurrentUser(request).id);
  }

  @Post('account/emergency-contacts')
  addContact(@Req() request: AuthenticatedRequest, @Body() body: EmergencyContactDto) {
    return this.account.addEmergencyContact(requireCurrentUser(request).id, body);
  }

  @Delete('account/emergency-contacts/:id')
  removeContact(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.account.removeEmergencyContact(requireCurrentUser(request).id, id);
  }

  @Post('providers')
  createProvider(@Req() request: AuthenticatedRequest, @Body() body: ProviderDto) {
    return this.account.createProvider(requireCurrentUser(request), body);
  }

  @Get('providers/mine')
  myProviders(@Req() request: AuthenticatedRequest) {
    return this.account.listMyProviders(requireCurrentUser(request).id);
  }

  @Post('provider/locations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  createLocation(@Req() request: AuthenticatedRequest, @Body() body: ProviderLocationDto) {
    return this.account.createProviderLocation(requireCurrentUser(request), body);
  }

  @Patch('provider/locations/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  updateLocation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ProviderLocationUpdateDto,
  ) {
    const { version, ...input } = body;
    return this.account.updateProviderLocation(requireCurrentUser(request), id, version, input);
  }

  @Get('provider/locations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  providerLocations(
    @Req() request: AuthenticatedRequest,
    @Query('providerId', new ParseUUIDPipe({ version: '4' })) providerId: string,
  ) {
    return this.account.listProviderLocations(requireCurrentUser(request), providerId);
  }

  @Get('admin/providers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminProviders(@Req() request: AuthenticatedRequest, @Query('status') status?: ProviderStatus) {
    return this.account.listProvidersForAdmin(requireCurrentUser(request), status);
  }

  @Patch('admin/providers/:id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  setProviderStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ProviderStatusDto,
  ) {
    return this.account.setProviderStatus(requireCurrentUser(request), id, body.status);
  }

  @Post('admin/categories')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createCategory(@Req() request: AuthenticatedRequest, @Body() body: CategoryCreateDto) {
    return this.account.createCategory(requireCurrentUser(request), body);
  }

  @Patch('admin/categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CategoryUpdateDto,
  ) {
    return this.account.updateCategory(requireCurrentUser(request), id, body);
  }
}
