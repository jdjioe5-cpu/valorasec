import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

import { SkipRateLimit } from '../rate-limit/rate-limit.decorator';

@ApiTags('Health')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbStatus = 'disconnected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      // Keep disconnected
    }

    return {
      data: {
        status: 'ok',
        version: '0.1.0',
        network: this.config.get<string>('STELLAR_NETWORK', 'testnet'),
        database: dbStatus,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
