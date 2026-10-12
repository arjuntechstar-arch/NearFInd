import {
  Body,
  Controller,
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
  IsEnum,
  IsInt,
  IsMimeType,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { CommunityService } from './community.service.js';
import { ContributionStatus } from './entities.js';
import { requireCurrentUser } from './http.js';

class EvidenceDto {
  @IsString() @MinLength(10) @MaxLength(1024) objectKey!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20_000_000) sizeBytes!: number;
}

class ContributionDto {
  @IsOptional() @IsUUID('4') serviceLocationId?: string | null;
  @IsString() @MinLength(2) @MaxLength(40) kind!: string;
  @IsObject() details!: Record<string, unknown>;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => EvidenceDto) evidence?: EvidenceDto[];
}

class ModerationDto {
  @IsEnum(ContributionStatus) decision!: ContributionStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

class ReviewDto {
  @IsUUID('4') serviceLocationId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(3000) comment?: string | null;
}

class ReviewMediaDto {
  @IsString() @MinLength(10) @MaxLength(1024) objectKey!: string;
  @IsString() @MinLength(2) @MaxLength(30) mediaType!: string;
}

@Controller()
export class CommunityController {
  constructor(@Inject(CommunityService) private readonly community: CommunityService) {}

  @Post('contributions')
  @UseGuards(AuthGuard)
  createContribution(@Req() request: AuthenticatedRequest, @Body() body: ContributionDto) {
    return this.community.createContribution(requireCurrentUser(request), body);
  }

  @Get('contributions/mine')
  @UseGuards(AuthGuard)
  myContributions(@Req() request: AuthenticatedRequest) {
    return this.community.listMyContributions(requireCurrentUser(request).id);
  }

  @Get('admin/moderation/contributions')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  moderationQueue(@Req() request: AuthenticatedRequest) {
    return this.community.moderationQueue(requireCurrentUser(request));
  }

  @Post('admin/moderation/contributions/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  moderate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ModerationDto,
  ) {
    return this.community.moderateContribution(requireCurrentUser(request), id, body.decision, body.note);
  }

  @Get('reviews')
  listReviews(@Query('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string) {
    return this.community.listReviews(placeId);
  }

  @Post('reviews')
  @UseGuards(AuthGuard)
  createReview(@Req() request: AuthenticatedRequest, @Body() body: ReviewDto) {
    return this.community.createReview(requireCurrentUser(request), body);
  }

  @Post('reviews/:id/media')
  @UseGuards(AuthGuard)
  addReviewMedia(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ReviewMediaDto,
  ) {
    return this.community.addReviewMedia(requireCurrentUser(request), id, body.objectKey, body.mediaType);
  }

  @Get('notifications')
  @UseGuards(AuthGuard)
  notifications(@Req() request: AuthenticatedRequest) {
    return this.community.listNotifications(requireCurrentUser(request).id);
  }

  @Patch('notifications/:id/read')
  @UseGuards(AuthGuard)
  markRead(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.community.markNotificationRead(requireCurrentUser(request).id, id);
  }

  @Get('offline-pack')
  @UseGuards(AuthGuard)
  offlinePack(@Req() request: AuthenticatedRequest) {
    return this.community.offlinePack(requireCurrentUser(request).id);
  }
}
