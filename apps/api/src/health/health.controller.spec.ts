import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    config = {
      get: jest.fn().mockImplementation((key: string, def?: unknown) => {
        if (key === 'STELLAR_NETWORK') return 'testnet';
        if (key === 'NODE_ENV') return 'test';
        if (key === 'REDIS_URL') return undefined;
        return def;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = moduleFixture.get<HealthController>(HealthController);
  });

  it('returns ok status and connected database when db query succeeds', async () => {
    const res = await controller.check();

    expect(res.data.status).toBe('ok');
    expect(res.data.database.status).toBe('connected');
    expect(typeof res.data.database.latencyMs).toBe('number');
    expect(res.data.redis.status).toBe('not_configured');
    expect(res.data.network).toBe('testnet');
  });

  it('returns error status and disconnected database when db query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

    const res = await controller.check();

    expect(res.data.status).toBe('error');
    expect(res.data.database.status).toBe('disconnected');
    expect(res.data.database.latencyMs).toBeNull();
  });
});
