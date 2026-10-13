import { Body, Controller, Get, Header, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsMimeType, IsObject, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, type AuthenticatedRequest } from '../identity/auth/auth.guard.js';
import { Roles, RolesGuard } from '../identity/auth/roles.js';
import { UserRole } from '../identity/entities/user.entity.js';
import { requireCurrentUser } from './http.js';
import { OperationsService } from './operations.service.js';

class UploadIntentDto {
  @IsString() @MinLength(2) @MaxLength(30) purpose!: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20_000_000) sizeBytes!: number;
}

class FeatureFlagDto {
  @IsBoolean() enabled!: boolean;
  @IsObject() config: Record<string, unknown> = {};
}

@Controller()
export class OperationsController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Post('uploads/presign')
  @UseGuards(AuthGuard)
  uploadIntent(@Req() request: AuthenticatedRequest, @Body() body: UploadIntentDto) {
    return this.operations.createUploadIntent(requireCurrentUser(request), body.purpose, body.mimeType, body.sizeBytes);
  }

  @Get('feature-flags/:key')
  featureFlag(@Param('key') key: string) {
    return this.operations.getFeatureFlag(key);
  }

  @Get('admin/feature-flags')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  featureFlags(@Req() request: AuthenticatedRequest) {
    return this.operations.listFeatureFlags(requireCurrentUser(request));
  }

  @Patch('admin/feature-flags/:key')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  setFeatureFlag(@Req() request: AuthenticatedRequest, @Param('key') key: string, @Body() body: FeatureFlagDto) {
    return this.operations.setFeatureFlag(requireCurrentUser(request), key, body.enabled, body.config);
  }

  @Get('admin/audit-events')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  auditEvents(@Req() request: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.operations.listAuditEvents(requireCurrentUser(request), Math.max(1, Math.min(500, Number(limit ?? 100) || 100)));
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics() {
    const memory = process.memoryUsage();
    return [
      '# HELP nearfind_process_uptime_seconds Process uptime in seconds.',
      '# TYPE nearfind_process_uptime_seconds gauge',
      `nearfind_process_uptime_seconds ${process.uptime().toFixed(3)}`,
      '# HELP nearfind_process_resident_memory_bytes Resident memory in bytes.',
      '# TYPE nearfind_process_resident_memory_bytes gauge',
      `nearfind_process_resident_memory_bytes ${memory.rss}`,
      '',
    ].join('\n');
  }
}
