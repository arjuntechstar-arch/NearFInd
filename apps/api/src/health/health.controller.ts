import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  status: 'ok';
  service: 'nearfind-api';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live(): HealthResponse {
    return {
      status: 'ok',
      service: 'nearfind-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  ready(): HealthResponse {
    // Database, Redis, object-storage and identity-provider checks are added as
    // those adapters are enabled. Until then this endpoint proves the API
    // process has completed bootstrap and can accept traffic.
    return {
      status: 'ok',
      service: 'nearfind-api',
      timestamp: new Date().toISOString(),
    };
  }
}
