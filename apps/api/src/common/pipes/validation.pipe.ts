import { ValidationPipe, ValidationError, BadRequestException } from '@nestjs/common';

/**
 * Recursively extracts flat validation error messages from class-validator ValidationError tree.
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const err of errors) {
    if (err.constraints) {
      messages.push(...Object.values(err.constraints));
    }
    if (err.children && err.children.length > 0) {
      messages.push(...formatValidationErrors(err.children));
    }
  }

  return messages;
}

/**
 * Creates the globally standard ValidationPipe for ValoraSec API.
 * Ensures whitelist stripping, rejection of non-whitelisted properties,
 * type transformation, and standardized RFC-compliant error responses:
 * { statusCode: 400, message: string[], error: 'Bad Request' }
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]): BadRequestException => {
      const messages = formatValidationErrors(errors);
      return new BadRequestException({
        statusCode: 400,
        message: messages,
        error: 'Bad Request',
      });
    },
  });
}
