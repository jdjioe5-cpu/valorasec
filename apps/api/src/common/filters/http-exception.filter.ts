import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    sub?: string;
    id?: string;
  };
  requestId?: string;
}

const DEFAULT_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const requestId =
      (request.headers?.['x-request-id'] as string) || request.requestId || randomUUID();

    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-Request-Id', requestId);
    }

    const timestamp = new Date().toISOString();
    const path = request.originalUrl || request.url || '';
    const method = request.method || 'UNKNOWN';
    const userId = request.user?.sub || request.user?.id || 'anonymous';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = DEFAULT_ERROR_NAMES[HttpStatus.INTERNAL_SERVER_ERROR] ?? 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      const defaultError = DEFAULT_ERROR_NAMES[statusCode] || exception.name || 'Error';

      if (typeof res === 'string') {
        message = res;
        error = defaultError;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj['message'] as string | string[]) || exception.message;
        error = (resObj['error'] as string) || defaultError;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = DEFAULT_ERROR_NAMES[HttpStatus.INTERNAL_SERVER_ERROR] ?? 'Internal Server Error';
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    const stack = exception instanceof Error ? exception.stack : undefined;

    // Structured JSON log output
    const logPayload = {
      timestamp,
      requestId,
      method,
      path,
      statusCode,
      userId,
      error,
      message,
      ...(isDevelopment && stack ? { stack } : {}),
    };

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(logPayload), stack);
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    // Client response format
    const responseBody: Record<string, unknown> = {
      statusCode,
      timestamp,
      path,
      method,
      requestId,
      message,
      error,
    };

    if (isDevelopment && stack && statusCode >= 500) {
      responseBody['stack'] = stack;
    }

    response.status(statusCode).json(responseBody);
  }
}
