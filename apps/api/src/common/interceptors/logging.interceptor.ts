import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
    email?: string;
  };
  requestId?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'refreshtoken',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'access_token',
  'refresh_token',
]);

/**
 * Recursively sanitizes sensitive fields in request bodies or query params.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<AuthenticatedRequest>();
    const res = ctx.getResponse<Response>();

    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || req.requestId || randomUUID();
    req.requestId = requestId;

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', requestId);
    }

    const { method, originalUrl, url } = req;
    const path = originalUrl || url || '';
    const userId = req.user?.sub || req.user?.id || 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode || 200;

          const logPayload = {
            timestamp: new Date().toISOString(),
            requestId,
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
            userId,
          };

          this.logger.log(JSON.stringify(logPayload));
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 500;

          const logPayload = {
            timestamp: new Date().toISOString(),
            requestId,
            method,
            path,
            statusCode,
            duration: `${duration}ms`,
            userId,
            error: err instanceof Error ? err.message : String(err),
          };

          this.logger.warn(JSON.stringify(logPayload));
        },
      }),
    );
  }
}
