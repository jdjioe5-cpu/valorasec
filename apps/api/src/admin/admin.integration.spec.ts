import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, mockUser, mockProject, createMockReport } from '../../test/test-setup';

describe('Admin and RBAC (Integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  const adminUser = mockUser({ id: 'admin-uid-1', role: 'admin' });
  const auditorUser = mockUser({ id: 'auditor-uid-2', role: 'auditor' });
  const regularUser = mockUser({ id: 'regular-uid-3', role: 'user' });

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AdminModule,
        PrismaModule,
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

  function getAccessToken(userId: string): string {
    return jwtService.sign({ sub: userId });
  }

  describe('GET /api/admin/users', () => {
    it('should return 403 Forbidden when accessed by a regular user', async () => {
      prisma.user.findUnique.mockResolvedValue(regularUser);

      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${getAccessToken(regularUser.id)}`)
        .expect(403);
    });

    it('should allow access and return user list when accessed by an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.user.findMany.mockResolvedValue([regularUser, auditorUser, adminUser]);
      prisma.user.count.mockResolvedValue(3);

      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${getAccessToken(adminUser.id)}`)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
    });
  });

  describe('GET /api/admin/reports', () => {
    it('should return 403 Forbidden when accessed by regular user', async () => {
      prisma.user.findUnique.mockResolvedValue(regularUser);

      await request(app.getHttpServer())
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${getAccessToken(regularUser.id)}`)
        .expect(403);
    });

    it('should allow access when accessed by an auditor', async () => {
      prisma.user.findUnique.mockResolvedValue(auditorUser);
      prisma.report.findMany.mockResolvedValue([createMockReport({ id: 'rep-auditor-1' })]);
      prisma.report.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${getAccessToken(auditorUser.id)}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('should allow access when accessed by an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);
      prisma.report.findMany.mockResolvedValue([createMockReport({ id: 'rep-admin-1' })]);
      prisma.report.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${getAccessToken(adminUser.id)}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('PATCH /api/admin/users/:userId/role', () => {
    it('should allow admin to update a user role and create audit notification', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) => {
        if (where.id === adminUser.id) return adminUser;
        if (where.id === regularUser.id) return regularUser;
        return null;
      });

      prisma.user.update.mockResolvedValue({
        ...regularUser,
        role: 'auditor',
      });
      prisma.notification.create.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .patch(`/api/admin/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${getAccessToken(adminUser.id)}`)
        .send({ role: 'auditor' })
        .expect(200);

      expect(res.body.data.role).toBe('auditor');
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: regularUser.id,
          type: 'role_changed',
        }),
      });
    });

    it('should reject invalid role string with 400 Bad Request', async () => {
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await request(app.getHttpServer())
        .patch(`/api/admin/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${getAccessToken(adminUser.id)}`)
        .send({ role: 'super-god-role' })
        .expect(400);
    });
  });

  describe('POST /api/admin/projects/:projectId/assign-auditor', () => {
    it('should allow admin to assign an auditor to a project', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) => {
        if (where.id === adminUser.id) return adminUser;
        if (where.id === auditorUser.id) return auditorUser;
        return null;
      });
      prisma.project.findUnique.mockResolvedValue(mockProject({ id: 'proj-target-1' }));
      prisma.notification.create.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/api/admin/projects/proj-target-1/assign-auditor')
        .set('Authorization', `Bearer ${getAccessToken(adminUser.id)}`)
        .send({ auditorId: auditorUser.id })
        .expect(201);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.projectId).toBe('proj-target-1');
      expect(res.body.data.auditorId).toBe(auditorUser.id);
    });
  });
});
