import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

interface HealthResponse {
  status: 'ok';
  service: 'nearfind-api';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live(): HealthResponse {
    return this.response();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
      return this.response();
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }

  private response(): HealthResponse {
    return {
      status: 'ok',
      service: 'nearfind-api',
      timestamp: new Date().toISOString(),
    };
  }
}
