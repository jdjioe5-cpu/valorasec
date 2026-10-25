import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRevocationService } from './token-revocation.service';
import { createPrismaMock, mockUser, mockSession } from '../../test/test-setup';

describe('Token Rotation and Replay Attack (Integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let revocationService: TokenRevocationService;

  const testUserId = 'victim-user-888';
  const initialRefreshToken = 'initial-token-aaa-111';

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

    revocationService = moduleFixture.get<TokenRevocationService>(TokenRevocationService);

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
    revocationService.clear();
  });

  it('should successfully rotate refresh token, and prevent replay attacks by invalidating all sessions and creating notification', async () => {
    // 1. Initial valid refresh session setup
    prisma.session.findUnique.mockResolvedValue(
      mockSession({
        userId: testUserId,
        refreshToken: initialRefreshToken,
      }),
    );
    prisma.user.findUnique.mockResolvedValue(mockUser({ id: testUserId }));
    prisma.session.delete.mockResolvedValue({});
    prisma.session.create.mockResolvedValue(
      mockSession({
        userId: testUserId,
        refreshToken: 'rotated-new-token-bbb-222',
      }),
    );

    // 2. Legitimate user requests token refresh with initialRefreshToken
    const refreshRes1 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(200);

    expect(refreshRes1.body.data.tokens).toBeDefined();
    expect(refreshRes1.body.data.tokens.refreshToken).toBeDefined();
    expect(refreshRes1.body.data.tokens.refreshToken).not.toBe(initialRefreshToken);

    // 3. Attacker replays initialRefreshToken
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });
    prisma.notification.create.mockResolvedValue({
      id: 'notif-alert-1',
      userId: testUserId,
      type: 'security_alert',
      title: 'Security Alert: Suspicious Token Reuse Detected',
      message: 'A previously rotated refresh token was reused.',
      read: false,
      metadata: {},
      createdAt: new Date(),
    });

    const replayRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(401);

    expect(replayRes.body.message).toContain('Refresh token reuse detected');

    // 4. Verify all active sessions were revoked
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: testUserId },
    });

    // 5. Verify security alert notification was generated
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: testUserId,
        type: 'security_alert',
      }),
    });
  });
});
