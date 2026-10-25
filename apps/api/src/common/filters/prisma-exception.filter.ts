import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Internal database error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.warn(`Prisma known request error [${exception.code}]: ${exception.message}`);

      switch (exception.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          error = 'Conflict';
          const target = exception.meta?.target as string[] | string | undefined;
          const targetStr = Array.isArray(target) ? target.join(', ') : target;
          message = targetStr
            ? `Unique constraint violation on field: ${targetStr}`
            : 'Unique constraint violation';
          break;
        }
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Foreign key constraint violation';
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Record not found';
          break;
        }
        case 'P2000': {
          statusCode = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Provided value is too long for the column';
          break;
        }
        case 'P2001': {
          statusCode = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Record not found';
          break;
        }
        case 'P2014': {
          statusCode = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Required relation constraint violation';
          break;
        }
        default: {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          error = 'Internal Server Error';
          message = 'Database operation failed';
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(`Prisma validation error: ${exception.message}`);
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Invalid database query parameters';
    } else {
      const errMsg = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`Prisma database error: ${errMsg}`);
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      message = 'Internal database error';
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
    });
  }
}
