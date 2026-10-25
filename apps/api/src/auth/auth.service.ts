import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  SessionInfo,
  RevokeSessionsResponse,
} from '@valorasec/shared';

export interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

export function parseUserAgent(ua?: string | null): {
  device: string;
  browser: string;
  os: string;
} {
  if (!ua) {
    return { device: 'Desktop', browser: 'Web Browser', os: 'Unknown OS' };
  }

  let browser = 'Web Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  let os = 'Unknown OS';
  if (/iPhone|iPod/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/iPhone|iPod|Android.*Mobile/i.test(ua)) device = 'Mobile';
  else if (/iPad|Android(?!.*Mobile)/i.test(ua)) device = 'Tablet';

  return { device, browser, os };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private generateRefreshToken(): string {
    return randomUUID();
  }

  private async generateTokens(userId: string, meta?: ClientMeta): Promise<AuthTokens> {
    const accessToken = this.jwt.sign({ sub: userId });
    const refreshToken = this.generateRefreshToken();
    const expiresInMs =
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_MS', '604800000')) || 604800000; // 7 days

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
        lastUsedAt: new Date(),
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
    meta?: ClientMeta,
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

    const tokens = await this.generateTokens(user.id, meta);

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

  async login(
    dto: LoginRequest,
    meta?: ClientMeta,
  ): Promise<{ user: Record<string, unknown>; tokens: AuthTokens }> {
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

    const tokens = await this.generateTokens(user.id, meta);

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
    meta?: ClientMeta,
  ): Promise<{ user: Record<string, unknown>; tokens: AuthTokens }> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: token },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get user information
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

    // Delete old session
    await this.prisma.session.delete({ where: { id: session.id } });

    // Create new tokens with preserved or fresh meta
    const effectiveMeta = meta ?? {
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
    };
    const tokens = await this.generateTokens(session.userId, effectiveMeta);

    return { user: user!, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
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

  // ─── Session Management (Issue #18) ──────────────────────────────────────

  async getUserSessions(userId: string, currentRefreshToken?: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => {
      const { device, browser, os } = parseUserAgent(s.userAgent);
      const isCurrent = Boolean(currentRefreshToken && s.refreshToken === currentRefreshToken);

      return {
        id: s.id,
        userId: s.userId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        device,
        browser,
        os,
        lastUsedAt: s.lastUsedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        isCurrent,
      };
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean; message: string; wasCurrent?: boolean }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return {
      success: true,
      message: 'Session revoked successfully',
    };
  }

  async revokeOtherSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<RevokeSessionsResponse> {
    const whereClause: { userId: string; refreshToken?: { not: string } } = { userId };
    if (currentRefreshToken) {
      whereClause.refreshToken = { not: currentRefreshToken };
    }

    const result = await this.prisma.session.deleteMany({
      where: whereClause,
    });

    return {
      revokedCount: result.count,
      message: 'All other sessions have been revoked successfully',
    };
  }
}
