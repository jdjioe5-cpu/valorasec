import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RateLimiterService } from './rate-limit.service';
import {
  RATE_LIMIT_METADATA_KEY,
  SKIP_RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isGlobalEnabled = this.config.get<string>('RATE_LIMIT_ENABLED', 'true') !== 'false';
    if (!isGlobalEnabled) {
      return true;
    }

    const handler = context.getHandler();
    const targetClass = context.getClass();

    // 1. Check if explicitly marked to skip rate limiting
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [
      handler,
      targetClass,
    ]);

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string; id?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();

    // 2. Bypass for health-check endpoints automatically per DoD
    const path = req.path || req.url || '';
    if (skipRateLimit || path.startsWith('/health') || path.startsWith('/api/health')) {
      return true;
    }

    // 3. Resolve Client IP safely
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : req.socket?.remoteAddress || req.ip || '127.0.0.1') || '127.0.0.1';

    // 4. Resolve Rate Limit Rules (Custom decorator or endpoint defaults)
    const customOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [handler, targetClass],
    );

    let limit = 100;
    let durationSec = 60;
    let key = '';

    if (customOptions) {
      limit = customOptions.points;
      durationSec = customOptions.durationSec;
      const prefix = customOptions.keyPrefix ?? 'custom';
      key = `rl:${prefix}:${clientIp}`;
    } else if (path.includes('/auth/login')) {
      // Login: max 5 attempts per IP per minute
      limit = Number(this.config.get<number>('RATE_LIMIT_LOGIN_LIMIT', 5));
      durationSec = Number(this.config.get<number>('RATE_LIMIT_LOGIN_TTL', 60));
      key = `rl:login:${clientIp}`;
    } else if (path.includes('/auth/register')) {
      // Register: max 3 accounts per IP per hour (3600 seconds)
      limit = Number(this.config.get<number>('RATE_LIMIT_REGISTER_LIMIT', 3));
      durationSec = Number(this.config.get<number>('RATE_LIMIT_REGISTER_TTL', 3600));
      key = `rl:register:${clientIp}`;
    } else {
      // General API: max 100 requests per minute per authenticated user (or IP)
      limit = Number(this.config.get<number>('RATE_LIMIT_API_LIMIT', 100));
      durationSec = Number(this.config.get<number>('RATE_LIMIT_API_TTL', 60));
      const userId = req.user?.sub || req.user?.id;
      key = userId ? `rl:api:user:${userId}` : `rl:api:ip:${clientIp}`;
    }

    // 5. Evaluate rate limit in storage
    const result = await this.rateLimiterService.checkRateLimit(key, limit, durationSec);

    // 6. Set standard rate limit headers
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetTime));
    }

    // 7. Enforce limit threshold
    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
