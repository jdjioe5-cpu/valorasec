import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { ScansModule } from '../src/scans/scans.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { createPrismaMock } from './test-setup';

describe('Scans (integration with Real Analyzer)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  const projectId = 'proj-scan-1';
  const contractId = 'ctr-scan-1';
  let authToken: string;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ScansModule,
        PrismaModule,
        AuthModule,
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authToken = jwtService.sign({
      sub: 'user-scan-1',
      email: 'scanner@example.com',
      role: 'user',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/projects/:projectId/contracts/:contractId/scan runs real analyzer scan', async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: contractId,
      projectId,
      name: 'VulnerableToken',
      address: 'CA1234567890',
      network: 'testnet',
      sourceHash: 'sha256-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    prisma.scan.create.mockImplementation((args: any) =>
      Promise.resolve({
        ...args.data,
        createdAt: new Date(),
      }),
    );

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contracts/${contractId}/scan`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.projectId).toBe(projectId);
    expect(res.body.data.contractId).toBe(contractId);
    expect(res.body.data.findings.length).toBeGreaterThan(0);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.score).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/scans/:scanId returns scan details', async () => {
    prisma.scan.findUnique.mockResolvedValue({
      id: 'scan-123',
      projectId,
      contractId,
      status: 'completed',
      findings: [],
      summary: { totalFindings: 0, score: 100 },
      startedAt: new Date(),
      contract: { id: contractId, name: 'VulnerableToken' },
    });

    const res = await request(app.getHttpServer())
      .get('/api/scans/scan-123')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.id).toBe('scan-123');
  });
});
