import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MetricsModule } from '../src/metrics/metrics.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Metrics (integration)', () => {
  let app: INestApplication;
  let mockPrisma: {
    user: { count: jest.Mock };
    scan: { count: jest.Mock };
  };

  beforeAll(async () => {
    mockPrisma = {
      user: { count: jest.fn().mockResolvedValue(10) },
      scan: { count: jest.fn().mockResolvedValue(2) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MetricsModule,
        PrismaModule,
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/metrics exposes Prometheus metrics with correct headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/metrics').expect(200);

    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# HELP http_requests_total');
    expect(res.text).toContain('# TYPE http_requests_total counter');
    expect(res.text).toContain('# HELP active_users');
    expect(res.text).toContain('# TYPE active_users gauge');
    expect(res.text).toContain('active_users 10');
    expect(res.text).toContain('# HELP scan_queue_depth');
    expect(res.text).toContain('scan_queue_depth 2');
    expect(res.text).toContain('db_connection_pool_active');
  });
});
