import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimiterService } from './rate-limit.service';
import { MemoryRateLimitStorage } from './redis-rate-limit.storage';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let service: RateLimiterService;
  let config: ConfigService;
  let reflector: Reflector;

  beforeEach(() => {
    config = new ConfigService({
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_LOGIN_LIMIT: 5,
      RATE_LIMIT_LOGIN_TTL: 60,
      RATE_LIMIT_REGISTER_LIMIT: 3,
      RATE_LIMIT_REGISTER_TTL: 3600,
      RATE_LIMIT_API_LIMIT: 100,
      RATE_LIMIT_API_TTL: 60,
    });

    service = new RateLimiterService(config);
    // Explicitly enforce clean in-memory store for unit tests
    service.setStorage(new MemoryRateLimitStorage());

    reflector = new Reflector();
    guard = new RateLimitGuard(reflector, config, service);
  });

  function createMockContext(options: {
    path: string;
    ip?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): {
    context: ExecutionContext;
    headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};

    const req = {
      path: options.path,
      url: options.path,
      ip: options.ip || '192.168.1.10',
      headers: {},
      socket: { remoteAddress: options.ip || '192.168.1.10' },
      user: options.userId ? { sub: options.userId } : undefined,
    };

    const res = {
      setHeader: (name: string, val: string) => {
        headers[name] = val;
      },
    };

    const context = {
      getHandler: () => () => {},
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    if (options.metadata) {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        return options.metadata?.[key];
      });
    }

    return { context, headers };
  }

  describe('Login endpoint rate limiting', () => {
    it('allows 5 attempts per IP and rejects the 6th with 429', async () => {
      const clientIp = '10.0.0.1';

      // 5 allowed attempts
      for (let i = 1; i <= 5; i++) {
        const { context, headers } = createMockContext({
          path: '/api/auth/login',
          ip: clientIp,
        });

        const allowed = await guard.canActivate(context);
        expect(allowed).toBe(true);
        expect(headers['X-RateLimit-Limit']).toBe('5');
        expect(headers['X-RateLimit-Remaining']).toBe(String(5 - i));
        expect(headers['X-RateLimit-Reset']).toBeDefined();
      }

      // 6th attempt should throw 429 Too Many Requests
      const { context, headers } = createMockContext({
        path: '/api/auth/login',
        ip: clientIp,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('Register endpoint rate limiting', () => {
    it('allows 3 accounts per IP per hour and rejects the 4th', async () => {
      const clientIp = '10.0.0.2';

      for (let i = 1; i <= 3; i++) {
        const { context, headers } = createMockContext({
          path: '/api/auth/register',
          ip: clientIp,
        });

        const allowed = await guard.canActivate(context);
        expect(allowed).toBe(true);
        expect(headers['X-RateLimit-Limit']).toBe('3');
        expect(headers['X-RateLimit-Remaining']).toBe(String(3 - i));
      }

      const { context } = createMockContext({
        path: '/api/auth/register',
        ip: clientIp,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });
  });

  describe('General API rate limiting', () => {
    it('isolates quota by authenticated user ID', async () => {
      const { context: ctx1, headers: h1 } = createMockContext({
        path: '/api/projects',
        userId: 'user-alice',
      });

      const { context: ctx2, headers: h2 } = createMockContext({
        path: '/api/projects',
        userId: 'user-bob',
      });

      await guard.canActivate(ctx1);
      expect(h1['X-RateLimit-Limit']).toBe('100');
      expect(h1['X-RateLimit-Remaining']).toBe('99');

      await guard.canActivate(ctx2);
      expect(h2['X-RateLimit-Limit']).toBe('100');
      expect(h2['X-RateLimit-Remaining']).toBe('99'); // Separate bucket for bob
    });
  });

  describe('Health check bypass', () => {
    it('bypasses rate limit unconditionally for health endpoints', async () => {
      for (let i = 0; i < 20; i++) {
        const { context } = createMockContext({
          path: '/health',
          ip: '10.0.0.99',
        });
        const allowed = await guard.canActivate(context);
        expect(allowed).toBe(true);
      }
    });

    it('bypasses when SkipRateLimit metadata is set', async () => {
      const { context } = createMockContext({
        path: '/api/any-path',
        metadata: { SKIP_RATE_LIMIT: true },
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });
  });
});
