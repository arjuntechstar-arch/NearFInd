import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { requireCurrentUser } from './http.js';
import { RewardsService } from './rewards.service.js';

class RedemptionDto {
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

class AwardDto {
  @IsUUID('4') userId!: string;
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) points!: number;
  @IsString() @MinLength(2) @MaxLength(50) sourceType!: string;
  @IsString() @MinLength(2) @MaxLength(160) sourceId!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
}

class PerkDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) costPoints!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) stock!: number;
}

class ChallengeDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @IsIn(['CONTRIBUTION', 'REVIEW']) targetType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) targetCount!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) rewardPoints!: number;
}

@Controller()
export class RewardsController {
  constructor(@Inject(RewardsService) private readonly rewards: RewardsService) {}

  @Get('rewards/wallet')
  @UseGuards(AuthGuard)
  wallet(@Req() request: AuthenticatedRequest) {
    return this.rewards.wallet(requireCurrentUser(request).id);
  }

  @Get('rewards/challenges')
  @UseGuards(AuthGuard)
  challenges(@Req() request: AuthenticatedRequest) {
    return this.rewards.syncChallenges(requireCurrentUser(request));
  }

  @Get('rewards/perks')
  perks() {
    return this.rewards.listPerks();
  }

  @Post('rewards/perks/:id/redemptions')
  @UseGuards(AuthGuard)
  redeem(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: RedemptionDto,
  ) {
    return this.rewards.redeem(requireCurrentUser(request), id, body.idempotencyKey);
  }

  @Get('rewards/leaderboard')
  leaderboard() {
    return this.rewards.leaderboard();
  }

  @Post('admin/rewards/awards')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  award(@Req() request: AuthenticatedRequest, @Body() body: AwardDto) {
    return this.rewards.award(requireCurrentUser(request), body);
  }

  @Post('admin/rewards/perks')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createPerk(@Req() request: AuthenticatedRequest, @Body() body: PerkDto) {
    return this.rewards.createPerk(requireCurrentUser(request), body);
  }

  @Post('admin/rewards/challenges')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createChallenge(@Req() request: AuthenticatedRequest, @Body() body: ChallengeDto) {
    return this.rewards.createChallenge(requireCurrentUser(request), body);
  }
}
