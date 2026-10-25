import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from './notifications.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { createPrismaMock } from '../../test/test-setup';

describe('Notifications & Email Preferences (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NotificationsModule,
        EmailModule,
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
        transformOptions: { enableImplicitConversion: true },
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

  function authHeader(userId = 'user-1'): { Authorization: string } {
    return { Authorization: `Bearer ${jwtService.sign({ sub: userId })}` };
  }

  describe('Auth Guard', () => {
    it('should return 401 for protected endpoints without token', async () => {
      await request(app.getHttpServer()).get('/api/notifications').expect(401);
      await request(app.getHttpServer()).get('/api/notifications/preferences').expect(401);
      await request(app.getHttpServer()).patch('/api/notifications/preferences').expect(401);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return notification preferences for authenticated user', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: true,
        reportPublished: false,
        verificationUpdates: true,
        unsubscribeToken: 'unsub-123',
      });

      const res = await request(app.getHttpServer())
        .get('/api/notifications/preferences')
        .set(authHeader('user-1'))
        .expect(200);

      expect(res.body.data.scanCompleted).toBe(true);
      expect(res.body.data.reportPublished).toBe(false);
      expect(res.body.data.verificationUpdates).toBe(true);
      expect(res.body.data.unsubscribeToken).toBe('unsub-123');
    });
  });

  describe('PATCH /api/notifications/preferences', () => {
    it('should update user notification preferences', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: true,
        reportPublished: true,
        verificationUpdates: true,
        unsubscribeToken: 'unsub-123',
      });
      prisma.notificationPreference.update.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        scanCompleted: false,
        reportPublished: true,
        verificationUpdates: false,
        unsubscribeToken: 'unsub-123',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .set(authHeader('user-1'))
        .send({ scanCompleted: false, verificationUpdates: false })
        .expect(200);

      expect(res.body.data.scanCompleted).toBe(false);
      expect(res.body.data.verificationUpdates).toBe(false);
    });

    it('should reject unexpected non-whitelisted properties', async () => {
      await request(app.getHttpServer())
        .patch('/api/notifications/preferences')
        .set(authHeader('user-1'))
        .send({ invalidProperty: 'bad' })
        .expect(400);
    });
  });

  describe('GET /api/notifications/unsubscribe (Public token unsubscribe)', () => {
    it('should unsubscribe using token without requiring login', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        unsubscribeToken: 'valid-token',
      });
      prisma.notificationPreference.update.mockResolvedValue({
        id: 'pref-1',
        scanCompleted: false,
      });

      const res = await request(app.getHttpServer())
        .get('/api/notifications/unsubscribe?token=valid-token&type=scanCompleted')
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Successfully unsubscribed');
    });

    it('should return error when token is invalid', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/notifications/unsubscribe?token=invalid-token')
        .expect(200);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.message).toContain('Invalid or expired');
    });
  });

  describe('POST /api/notifications/unsubscribe', () => {
    it('should unsubscribe via POST body', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        unsubscribeToken: 'post-token',
      });
      prisma.notificationPreference.update.mockResolvedValue({
        id: 'pref-1',
        scanCompleted: false,
        reportPublished: false,
        verificationUpdates: false,
      });

      const res = await request(app.getHttpServer())
        .post('/api/notifications/unsubscribe')
        .send({ token: 'post-token' })
        .expect(201);

      expect(res.body.data.success).toBe(true);
    });
  });
});
