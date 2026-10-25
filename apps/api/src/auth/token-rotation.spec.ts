import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenRevocationService } from './token-revocation.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, mockUser, mockSession } from '../../test/test-setup';

describe('AuthService Token Rotation and Replay Detection (Unit)', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let revocationService: TokenRevocationService;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenRevocationService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
    revocationService = moduleRef.get<TokenRevocationService>(TokenRevocationService);
    revocationService.clear();
  });

  it('should rotate tokens atomically in a single transaction', async () => {
    const originalToken = 'original-refresh-token';
    const oldSession = mockSession({ refreshToken: originalToken, userId: 'user-1' });

    prisma.session.findUnique.mockResolvedValue(oldSession);
    prisma.user.findUnique.mockResolvedValue(mockUser({ id: 'user-1' }));
    prisma.session.delete.mockResolvedValue(oldSession);
    prisma.session.create.mockResolvedValue(mockSession({ userId: 'user-1' }));

    const result = await service.refreshToken(originalToken);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.tokens.refreshToken).not.toEqual(originalToken);
    expect(result.tokens.accessToken).toBe('mock-access-token');

    // Confirm that the old token was marked as revoked in TokenRevocationService
    const check = await revocationService.checkRevocation(originalToken);
    expect(check.isRevoked).toBe(true);
    expect(check.userId).toBe('user-1');
  });

  it('should detect token replay attack, revoke all user sessions, and create a security notification', async () => {
    const token = 'compromised-refresh-token';
    const userId = 'victim-user-123';

    // Simulate token having been rotated earlier
    await revocationService.recordRevokedToken(token, userId);

    prisma.session.deleteMany.mockResolvedValue({ count: 3 });
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      userId,
      type: 'security_alert',
      title: 'Security Alert: Suspicious Token Reuse Detected',
      message: 'A previously rotated refresh token was reused.',
      read: false,
      metadata: {},
      createdAt: new Date(),
    });

    await expect(service.refreshToken(token)).rejects.toThrow(UnauthorizedException);

    // Verify all sessions were deleted
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });

    // Verify security notification was created
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        type: 'security_alert',
        title: expect.stringContaining('Security Alert'),
        message: expect.stringContaining('All active sessions have been terminated'),
      }),
    });
  });

  it('should mark token as revoked on logout and protect against reuse', async () => {
    const token = 'logout-refresh-token';
    const userId = 'user-logout';

    prisma.session.findUnique.mockResolvedValue(mockSession({ refreshToken: token, userId }));
    prisma.session.delete.mockResolvedValue({});

    await service.logout(token);

    expect(prisma.session.delete).toHaveBeenCalled();

    // Check that logout-token is recorded in revocation store
    const check = await revocationService.checkRevocation(token);
    expect(check.isRevoked).toBe(true);
    expect(check.userId).toBe(userId);
  });
});
