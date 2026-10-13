import { Body, Controller, Inject, Post } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../entities/user.entity.js';
import { DevAuthService } from './dev-auth.service.js';

class DevLoginDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@Controller('dev-auth')
export class DevAuthController {
  constructor(@Inject(DevAuthService) private readonly development: DevAuthService) {}

  @Post('login')
  login(@Body() body: DevLoginDto) {
    return this.development.issue(body.role ?? UserRole.USER);
  }
}
