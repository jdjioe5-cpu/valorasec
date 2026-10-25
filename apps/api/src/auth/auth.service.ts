import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRevocationService } from './token-revocation.service';
import type { AuthTokens, LoginRequest, RegisterRequest } from '@valorasec/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokenRevocation: TokenRevocationService,
  ) {}

  private generateRefreshToken(): string {
    return randomUUID();
  }

  private async generateTokens(userId: string): Promise<AuthTokens> {
    const accessToken = this.jwt.sign({ sub: userId });
    const refreshToken = this.generateRefreshToken();
    const expiresInMs =
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_MS', '604800000'), 10) || 604800000; // 7 days

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInMs,
    };
  }

  async register(
    dto: RegisterRequest,
  ): Promise<{ user: Record<string, unknown>; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verifyToken = randomUUID();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        verifyToken,
      },
    });

    const tokens = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async login(dto: LoginRequest): Promise<{ user: Record<string, unknown>; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async refreshToken(
    token: string,
  ): Promise<{ user: Record<string, unknown>; tokens: AuthTokens }> {
    // 1. Detect rotation reuse (Replay Attack)
    const revocation = await this.tokenRevocation.checkRevocation(token);
    if (revocation.isRevoked && revocation.userId) {
      this.logger.warn(
        `Rotation reuse detected for user ${revocation.userId}. Revoking all sessions.`,
      );

      // Revoke all active sessions for this user
      await this.prisma.session.deleteMany({
        where: { userId: revocation.userId },
      });

      // Trigger security alert notification to user
      await this.prisma.notification.create({
        data: {
          userId: revocation.userId,
          type: 'security_alert',
          title: 'Security Alert: Suspicious Token Reuse Detected',
          message:
            'A previously rotated refresh token was reused. All active sessions have been terminated to safeguard your account.',
          metadata: {
            reason: 'token_reuse_detected',
            timestamp: new Date().toISOString(),
          },
        },
      });

      throw new UnauthorizedException(
        'Refresh token reuse detected. All sessions have been revoked.',
      );
    }

    // 2. Validate current session
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: token },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 3. Get user information
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 4. Atomically delete old session and create new session in a single transaction
    const newRefreshToken = this.generateRefreshToken();
    const expiresInMs =
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_MS', '604800000'), 10) || 604800000;
    const expiresAt = new Date(Date.now() + expiresInMs);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.delete({ where: { id: session.id } });
      await tx.session.create({
        data: {
          userId: session.userId,
          refreshToken: newRefreshToken,
          expiresAt,
        },
      });
    });

    // 5. Mark the old refresh token as revoked/rotated for replay attack detection
    await this.tokenRevocation.recordRevokedToken(token, session.userId, expiresInMs);

    const accessToken = this.jwt.sign({ sub: session.userId });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: expiresInMs,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
      // Record as revoked so attempting to reuse it triggers replay detection
      await this.tokenRevocation.recordRevokedToken(refreshToken, session.userId);
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
