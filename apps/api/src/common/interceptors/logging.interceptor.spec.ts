import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor, sanitizeLogData } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockContext: ExecutionContext;
  let mockRequest: {
    method: string;
    url: string;
    originalUrl: string;
    headers: Record<string, string>;
    user?: { sub: string };
    requestId?: string;
  };
  let mockResponse: {
    statusCode: number;
    setHeader: jest.Mock;
  };
  let mockNext: CallHandler;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockRequest = {
      method: 'GET',
      url: '/api/projects',
      originalUrl: '/api/projects',
      headers: { 'x-request-id': 'custom-id-999' },
      user: { sub: 'user-xyz' },
    };
    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
    };
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  it('should set X-Request-Id header on response and log completed request', (done) => {
    mockNext = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'custom-id-999');
        done();
      },
    });
  });

  it('should handle and log request error with duration and status code', (done) => {
    const error = Object.assign(new Error('Test Failure'), { status: 404 });

    mockNext = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(mockContext, mockNext).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'custom-id-999');
        done();
      },
    });
  });

  describe('sanitizeLogData', () => {
    it('should mask sensitive keys including password, token, refreshToken, and authorization', () => {
      const sensitiveInput = {
        email: 'user@example.com',
        password: 'superSecretPassword!',
        refreshToken: 'refresh-token-uuid',
        token: 'jwt-access-token',
        secret: 'api-secret-key',
        authorization: 'Bearer token-value',
        profile: {
          name: 'Alice',
          password: 'nestedPassword',
          apiKey: 'key-123',
        },
      };

      const sanitized = sanitizeLogData(sensitiveInput) as Record<string, unknown>;
      const profile = sanitized['profile'] as Record<string, unknown>;

      expect(sanitized['email']).toBe('user@example.com');
      expect(sanitized['password']).toBe('[REDACTED]');
      expect(sanitized['refreshToken']).toBe('[REDACTED]');
      expect(sanitized['token']).toBe('[REDACTED]');
      expect(sanitized['secret']).toBe('[REDACTED]');
      expect(sanitized['authorization']).toBe('[REDACTED]');
      expect(profile['name']).toBe('Alice');
      expect(profile['password']).toBe('[REDACTED]');
      expect(profile['apiKey']).toBe('[REDACTED]');
    });

    it('should safely preserve non-object and array data', () => {
      expect(sanitizeLogData(null)).toBeNull();
      expect(sanitizeLogData(undefined)).toBeUndefined();
      expect(sanitizeLogData('safe-string')).toBe('safe-string');
      expect(sanitizeLogData([1, 2, 'hello'])).toEqual([1, 2, 'hello']);
    });
  });
});
