import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AuthModule } from './auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { createPrismaMock, mockUser, mockSession } from '../../test/test-setup';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  const testUser = {
    id: 'user-1',
    email: 'test@valorasec.dev',
    password: 'test123456', // plaintext for requests
    name: 'Test User',
  };

  const hashedPassword = bcrypt.hashSync(testUser.password, 12);

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AuthModule,
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

  // ─── Helper ────────────────────────────────────────────────────────────

  function getAccessToken(userId = 'user-1'): string {
    return jwtService.sign({ sub: userId });
  }

  // ─── POST /api/auth/register ──────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing user
      prisma.user.create.mockResolvedValue(mockUser({ passwordHash: hashedPassword }));
      prisma.session.create.mockResolvedValue(mockSession({ refreshToken: expect.any(String) }));

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.name).toBe(testUser.name);
      expect(res.body.data.user.passwordHash).toBeUndefined(); // never expose hash
      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should return 409 for duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect(409);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: testUser.password,
          name: testUser.name,
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: 'short',
          name: testUser.name,
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for empty name', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: '',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: testUser.email })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  // ─── POST /api/auth/login ─────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ passwordHash: hashedPassword }));
      prisma.session.create.mockResolvedValue(mockSession());

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ passwordHash: hashedPassword }));

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword123',
        })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'bad-email',
          password: testUser.password,
        })
        .expect(400);
    });
  });

  // ─── POST /api/auth/refresh ───────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession());
      prisma.session.delete.mockResolvedValue({});
      prisma.session.create.mockResolvedValue(mockSession({ refreshToken: 'new-refresh-token' }));
      prisma.user.findUnique.mockResolvedValue(mockUser());

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'refresh-token-123' })
        .expect(200);

      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should return 401 for invalid refresh token', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should return 401 for expired refresh token', async () => {
      prisma.session.findUnique.mockResolvedValue(
        mockSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      prisma.session.delete.mockResolvedValue({});

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);
    });
  });

  // ─── GET /api/auth/profile ────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid JWT', async () => {
      const userWithoutHash: Record<string, unknown> = { ...mockUser() };
      delete userWithoutHash.passwordHash;
      prisma.user.findUnique.mockResolvedValue(userWithoutHash);
      const token = getAccessToken();

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/profile').expect(401);
    });

    it('should return 401 with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);
    });

    it('should return 401 with wrong auth scheme', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Basic some-token')
        .expect(401);
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('should logout and delete session', async () => {
      prisma.session.findUnique.mockResolvedValue(mockSession());
      prisma.session.delete.mockResolvedValue({});
      const token = getAccessToken();

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'refresh-token-123' })
        .expect(200);

      expect(res.body.data.message).toBe('Logged out successfully');
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('should still return 200 even if session not found', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      const token = getAccessToken();

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'unknown-token' })
        .expect(200);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: 'refresh-token-123' })
        .expect(401);
    });
  });

  // ─── GET /api/auth/sessions (Issue #18) ───────────────────────────────

  describe('GET /api/auth/sessions', () => {
    it('should return all active sessions for current user', async () => {
      const token = getAccessToken('user-1');
      prisma.session.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          userId: 'user-1',
          refreshToken: 'rt-1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          ipAddress: '127.0.0.1',
          lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + 100000),
          createdAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-refresh-token', 'rt-1')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('sess-1');
      expect(res.body.data[0].isCurrent).toBe(true);
      expect(res.body.data[0].browser).toBe('Google Chrome');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/auth/sessions').expect(401);
    });
  });

  // ─── DELETE /api/auth/sessions/:id (Issue #18) ────────────────────────

  describe('DELETE /api/auth/sessions/:id', () => {
    it('should revoke a session by id', async () => {
      const token = getAccessToken('user-1');
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-target',
        userId: 'user-1',
      });
      prisma.session.delete.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .delete('/api/auth/sessions/sess-target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'sess-target' },
      });
    });

    it('should return 404 if session not found or belongs to another user', async () => {
      const token = getAccessToken('user-1');
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-other',
        userId: 'different-user',
      });

      await request(app.getHttpServer())
        .delete('/api/auth/sessions/sess-other')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── DELETE /api/auth/sessions (Issue #18) ────────────────────────────

  describe('DELETE /api/auth/sessions', () => {
    it('should revoke all other sessions preserving current', async () => {
      const token = getAccessToken('user-1');
      prisma.session.deleteMany.mockResolvedValue({ count: 2 });

      const res = await request(app.getHttpServer())
        .delete('/api/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-refresh-token', 'my-current-token')
        .expect(200);

      expect(res.body.data.revokedCount).toBe(2);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          refreshToken: { not: 'my-current-token' },
        },
      });
    });
  });
});
