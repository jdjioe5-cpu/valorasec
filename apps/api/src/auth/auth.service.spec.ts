import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService, parseUserAgent } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, mockUser, mockSession } from '../../test/test-setup';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const testPassword = 'Password123!';
  const hashedPassword = bcrypt.hashSync(testPassword, 12);

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => defaultValue ?? '604800000'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  describe('parseUserAgent helper', () => {
    it('should parse Chrome on Windows correctly', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Google Chrome');
      expect(parsed.os).toBe('Windows');
      expect(parsed.device).toBe('Desktop');
    });

    it('should parse Safari on iPhone correctly', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const parsed = parseUserAgent(ua);
      expect(parsed.browser).toBe('Apple Safari');
      expect(parsed.os).toBe('iOS');
      expect(parsed.device).toBe('Mobile');
    });

    it('should return safe defaults when UA is missing or empty', () => {
      const parsed = parseUserAgent(null);
      expect(parsed.browser).toBe('Web Browser');
      expect(parsed.device).toBe('Desktop');
    });
  });

  describe('register & login with client meta', () => {
    it('should capture userAgent and ipAddress in session record', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser());
      prisma.session.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve(mockSession(args.data)),
      );

      const meta = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
        ipAddress: '192.168.1.100',
      };

      const result = await service.register(
        { email: 'new@valorasec.dev', password: testPassword, name: 'New User' },
        meta,
      );

      expect(result.tokens).toBeDefined();
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userAgent: meta.userAgent,
            ipAddress: meta.ipAddress,
          }),
        }),
      );
    });

    it('should login and capture client meta', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({
          email: 'login@valorasec.dev',
          passwordHash: hashedPassword,
        }),
      );
      prisma.session.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve(mockSession(args.data)),
      );

      const meta = { userAgent: 'Firefox/120.0', ipAddress: '10.0.0.1' };
      const res = await service.login(
        { email: 'login@valorasec.dev', password: testPassword },
        meta,
      );

      expect(res.tokens).toBeDefined();
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userAgent: meta.userAgent,
            ipAddress: meta.ipAddress,
          }),
        }),
      );
    });
  });

  describe('getUserSessions (Issue #18)', () => {
    it('should list all active sessions and flag current session', async () => {
      const currentToken = 'token-current-1';
      const otherToken = 'token-other-2';

      prisma.session.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          userId: 'user-1',
          refreshToken: currentToken,
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ipAddress: '192.168.1.1',
          lastUsedAt: new Date('2026-10-25T10:00:00Z'),
          expiresAt: new Date('2026-11-01T10:00:00Z'),
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
        {
          id: 'sess-2',
          userId: 'user-1',
          refreshToken: otherToken,
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
          ipAddress: '10.0.0.2',
          lastUsedAt: new Date('2026-10-24T08:00:00Z'),
          expiresAt: new Date('2026-10-31T08:00:00Z'),
          createdAt: new Date('2026-10-24T08:00:00Z'),
        },
      ]);

      const sessions = await service.getUserSessions('user-1', currentToken);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('sess-1');
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[0].browser).toBe('Google Chrome');
      expect(sessions[0].os).toBe('macOS');
      expect(sessions[0].device).toBe('Desktop');

      expect(sessions[1].id).toBe('sess-2');
      expect(sessions[1].isCurrent).toBe(false);
      expect(sessions[1].browser).toBe('Apple Safari');
      expect(sessions[1].os).toBe('iOS');
      expect(sessions[1].device).toBe('Mobile');
    });
  });

  describe('revokeSession (Issue #18)', () => {
    it('should revoke a session owned by user', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-to-revoke',
        userId: 'user-1',
      });
      prisma.session.delete.mockResolvedValue({});

      const res = await service.revokeSession('user-1', 'sess-to-revoke');
      expect(res.success).toBe(true);
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'sess-to-revoke' },
      });
    });

    it('should throw NotFoundException if session belongs to another user', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-other-user',
        userId: 'user-2', // different user
      });

      await expect(service.revokeSession('user-1', 'sess-other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.revokeSession('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revokeOtherSessions (Issue #18)', () => {
    it('should revoke all other sessions preserving current', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      const res = await service.revokeOtherSessions('user-1', 'current-token-abc');
      expect(res.revokedCount).toBe(3);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          refreshToken: { not: 'current-token-abc' },
        },
      });
    });

    it('should revoke all sessions if current token not specified', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });

      const res = await service.revokeOtherSessions('user-1');
      expect(res.revokedCount).toBe(5);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
      });
    });
  });
});
