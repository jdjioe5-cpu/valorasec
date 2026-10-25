import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { RulesModule } from '../src/rules/rules.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { createPrismaMock, createMockSecurityRule } from '@valorasec/test-utils';

describe('Rules (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        RulesModule,
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function authHeader(userId = 'user-1', email = 'test@example.com'): { Authorization: string } {
    return { Authorization: `Bearer ${jwtService.sign({ sub: userId, email })}` };
  }

  describe('GET /api/rules', () => {
    it('returns list of rules with pagination meta', async () => {
      const mockRules = [createMockSecurityRule({ id: 'r1', name: 'check-auth' })];
      prisma.securityRule.findMany.mockResolvedValue(mockRules);
      prisma.securityRule.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer()).get('/api/rules').expect(200);

      expect(res.body.data).toEqual(mockRules);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('GET /api/rules/:id', () => {
    it('returns single rule by id', async () => {
      const mockRule = createMockSecurityRule({ id: 'r1', name: 'check-auth' });
      prisma.securityRule.findUnique.mockResolvedValue(mockRule);

      const res = await request(app.getHttpServer()).get('/api/rules/r1').expect(200);

      expect(res.body.data.id).toBe('r1');
    });

    it('returns 404 when rule not found', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/api/rules/missing-id').expect(404);
    });
  });

  describe('POST /api/rules (Create)', () => {
    it('returns 401 when unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/api/rules')
        .send({
          name: 'unauthorized-rule',
          category: 'storage',
          severity: 'high',
          description: 'test',
          recommendation: 'test',
        })
        .expect(401);
    });

    it('creates custom security rule when authenticated', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);
      const created = createMockSecurityRule({ id: 'new-r1', name: 'custom-check' });
      prisma.securityRule.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/rules')
        .set(authHeader())
        .send({
          name: 'custom-check',
          category: 'authorization',
          severity: 'high',
          description: 'A custom security rule check',
          recommendation: 'Fix it with guard',
        })
        .expect(201);

      expect(res.body.data.id).toBe('new-r1');
      expect(prisma.securityRule.create).toHaveBeenCalled();
    });

    it('returns 400 when missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/rules')
        .set(authHeader())
        .send({
          name: 'incomplete',
        })
        .expect(400);
    });
  });

  describe('PATCH /api/rules/:id', () => {
    it('allows author to update rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, title: 'Updated Title' });

      const res = await request(app.getHttpServer())
        .patch('/api/rules/r1')
        .set(authHeader('user-1'))
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated Title');
    });

    it('returns 403 when updating another user rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);

      await request(app.getHttpServer())
        .patch('/api/rules/r1')
        .set(authHeader('user-2'))
        .send({ title: 'Malicious Update' })
        .expect(403);
    });
  });

  describe('DELETE /api/rules/:id', () => {
    it('allows author to delete rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.delete.mockResolvedValue(rule);

      const res = await request(app.getHttpServer())
        .delete('/api/rules/r1')
        .set(authHeader('user-1'))
        .expect(200);

      expect(res.body.data.message).toContain('deleted successfully');
    });

    it('returns 403 when deleting another user rule', async () => {
      const rule = createMockSecurityRule({ id: 'r1', authorId: 'user-1' });
      prisma.securityRule.findUnique.mockResolvedValue(rule);

      await request(app.getHttpServer())
        .delete('/api/rules/r1')
        .set(authHeader('user-2'))
        .expect(403);
    });
  });

  describe('POST /api/rules/:id/toggle & install', () => {
    it('toggles rule enabled status', async () => {
      const rule = createMockSecurityRule({ id: 'r1', enabled: true });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, enabled: false });

      const res = await request(app.getHttpServer())
        .post('/api/rules/r1/toggle')
        .set(authHeader())
        .expect(201);

      expect(res.body.data.enabled).toBe(false);
    });

    it('installs rule and increments downloads', async () => {
      const rule = createMockSecurityRule({ id: 'r1', downloads: 10 });
      prisma.securityRule.findUnique.mockResolvedValue(rule);
      prisma.securityRule.update.mockResolvedValue({ ...rule, downloads: 11 });

      const res = await request(app.getHttpServer())
        .post('/api/rules/r1/install')
        .set(authHeader())
        .expect(201);

      expect(res.body.data.downloads).toBe(11);
    });
  });

  describe('Export & Import', () => {
    it('GET /api/rules/export returns structured JSON', async () => {
      prisma.securityRule.findMany.mockResolvedValue([createMockSecurityRule()]);

      const res = await request(app.getHttpServer()).get('/api/rules/export').expect(200);

      expect(res.body.data.version).toBe('1.0.0');
      expect(Array.isArray(res.body.data.rules)).toBe(true);
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('POST /api/rules/import imports rules array', async () => {
      prisma.securityRule.findUnique.mockResolvedValue(null);
      prisma.securityRule.create.mockResolvedValue(createMockSecurityRule());

      const res = await request(app.getHttpServer())
        .post('/api/rules/import')
        .set(authHeader())
        .send({
          rules: [
            {
              name: 'imported-rule-1',
              category: 'storage',
              severity: 'high',
              description: 'Imported test rule',
              recommendation: 'Fix storage',
            },
          ],
        })
        .expect(201);

      expect(res.body.data.importedCount).toBe(1);
    });
  });
});
