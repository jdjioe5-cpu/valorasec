import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private redisClient: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl && this.config.get<string>('NODE_ENV') !== 'test') {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });
      } catch {
        this.redisClient = null;
      }
    }
  }

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbStatus = 'disconnected';
    let dbLatencyMs: number | null = null;

    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      // Keep disconnected
    }

    let redisStatus = 'not_configured';
    let redisLatencyMs: number | null = null;
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (redisUrl) {
      const redisStart = Date.now();
      try {
        if (!this.redisClient) {
          this.redisClient = new Redis(redisUrl, {
            lazyConnect: true,
            connectTimeout: 1500,
            maxRetriesPerRequest: 1,
          });
        }
        await this.redisClient.ping();
        redisStatus = 'connected';
        redisLatencyMs = Date.now() - redisStart;
      } catch {
        redisStatus = 'disconnected';
      }
    }

    const overallStatus = dbStatus === 'connected' ? 'ok' : 'error';

    return {
      data: {
        status: overallStatus,
        version: '0.1.0',
        network: this.config.get<string>('STELLAR_NETWORK', 'testnet'),
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }
}
