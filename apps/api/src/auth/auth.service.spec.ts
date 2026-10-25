import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { createPrismaMock, mockUser, mockSession } from '../../test/test-setup';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let emailService: { sendVerificationEmail: jest.Mock };

  const testPassword = 'Password123!';
  const hashedPassword = bcrypt.hashSync(testPassword, 12);

  beforeEach(async () => {
    prisma = createPrismaMock();
    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
    };

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
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = moduleRef.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should generate verifyToken with 24h expiration and trigger verification email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...mockUser(),
          email: args.data.email as string,
          name: args.data.name as string,
          isVerified: false,
          verifyToken: args.data.verifyToken as string,
          verifyExpires: args.data.verifyExpires as Date,
        }),
      );
      prisma.session.create.mockResolvedValue(mockSession());

      const result = await service.register({
        email: 'newuser@valorasec.dev',
        password: testPassword,
        name: 'New User',
      });

      expect(result.user.email).toBe('newuser@valorasec.dev');
      expect(result.user.isVerified).toBe(false);

      // Verify Prisma create was called with verifyToken and expiration
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVerified: false,
            verifyToken: expect.any(String),
            verifyExpires: expect.any(Date),
          }),
        }),
      );

      // Verify email was sent
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'newuser@valorasec.dev',
        'New User',
        expect.any(String),
      );
    });
  });

  describe('login', () => {
    it('should disallow unverified users and return EMAIL_NOT_VERIFIED code', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({
          email: 'unverified@valorasec.dev',
          passwordHash: hashedPassword,
          isVerified: false,
        }),
      );

      await expect(
        service.login({
          email: 'unverified@valorasec.dev',
          password: testPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login({
          email: 'unverified@valorasec.dev',
          password: testPassword,
        });
      } catch (err: unknown) {
        const error = err as UnauthorizedException;
        expect(error.getResponse()).toMatchObject({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in.',
          email: 'unverified@valorasec.dev',
        });
      }
    });

    it('should allow verified users to log in successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({
          email: 'verified@valorasec.dev',
          passwordHash: hashedPassword,
          isVerified: true,
        }),
      );
      prisma.session.create.mockResolvedValue(mockSession());

      const result = await service.login({
        email: 'verified@valorasec.dev',
        password: testPassword,
      });

      expect(result.tokens).toBeDefined();
      expect(result.user.isVerified).toBe(true);
    });
  });

  describe('verifyEmail', () => {
    it('should verify user and clear token when valid', async () => {
      const validToken = 'valid-token-123';
      prisma.user.findFirst.mockResolvedValue(
        mockUser({
          id: 'user-to-verify',
          isVerified: false,
          verifyToken: validToken,
          verifyExpires: new Date(Date.now() + 3600000), // 1 hour left
        }),
      );
      prisma.user.update.mockResolvedValue(mockUser({ isVerified: true, verifyToken: null }));

      const res = await service.verifyEmail(validToken);

      expect(res.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-verify' },
        data: {
          isVerified: true,
          verifyToken: null,
          verifyExpires: null,
        },
      });
    });

    it('should throw NotFoundException if token does not match any user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('nonexistent-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if token has expired (> 24 hours)', async () => {
      prisma.user.findFirst.mockResolvedValue(
        mockUser({
          isVerified: false,
          verifyToken: 'expired-token',
          verifyExpires: new Date(Date.now() - 1000), // expired 1s ago
        }),
      );

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerification', () => {
    it('should generate new token and send email for unverified user', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({
          id: 'u-unverified',
          email: 'unverified@test.dev',
          name: 'Bob',
          isVerified: false,
        }),
      );
      prisma.user.update.mockResolvedValue({});

      const res = await service.resendVerification('unverified@test.dev');

      expect(res.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-unverified' },
          data: expect.objectContaining({
            verifyToken: expect.any(String),
            verifyExpires: expect.any(Date),
          }),
        }),
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'unverified@test.dev',
        'Bob',
        expect.any(String),
      );
    });

    it('should notify if user is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({
          email: 'already-verified@test.dev',
          isVerified: true,
        }),
      );

      const res = await service.resendVerification('already-verified@test.dev');
      expect(res.success).toBe(true);
      expect(res.message).toContain('already verified');
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should return safe message when email does not exist to prevent enumeration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await service.resendVerification('ghost@test.dev');
      expect(res.success).toBe(true);
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
