import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  VerifyEmailResponse,
  ResendVerificationResponse,
} from '@valorasec/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private generateRefreshToken(): string {
    return randomUUID();
  }

  private async generateTokens(userId: string): Promise<AuthTokens> {
    const accessToken = this.jwt.sign({ sub: userId });
    const refreshToken = this.generateRefreshToken();
    const expiresInMs =
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_MS', '604800000')) || 604800000; // 7 days

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
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        isVerified: false,
        verifyToken,
        verifyExpires,
      },
    });

    // Send verification email asynchronously
    try {
      await this.emailService.sendVerificationEmail(user.email, user.name, verifyToken);
    } catch {
      // Don't fail registration if mail fails, token is safely saved
    }

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

    // Require email verification per acceptance criteria
    if (!user.isVerified) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before logging in.',
        email: user.email,
      });
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

  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.prisma.user.findFirst({
      where: { verifyToken: token },
    });

    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }

    if (user.verifyExpires && user.verifyExpires < new Date()) {
      throw new BadRequestException(
        'Verification link has expired. Please request a new verification email.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verifyToken: null,
        verifyExpires: null,
      },
    });

    return {
      success: true,
      message: 'Email verified successfully. You can now log in.',
    };
  }

  async resendVerification(email: string): Promise<ResendVerificationResponse> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Avoid account enumeration: return success even if user not found
      return {
        success: true,
        message:
          'If an unverified account exists with that email, a verification link has been sent.',
      };
    }

    if (user.isVerified) {
      return {
        success: true,
        message: 'Your account is already verified. You can log in directly.',
      };
    }

    const verifyToken = randomUUID();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken,
        verifyExpires,
      },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, verifyToken);

    return {
      success: true,
      message: 'Verification link resent. Please check your inbox.',
    };
  }

  async refreshToken(
    token: string,
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

    // Create new tokens
    const tokens = await this.generateTokens(session.userId);

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
}
