import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format P2002 unique constraint violation as 409 Conflict with target field', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['email'] },
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Unique constraint violation on field: email',
      error: 'Conflict',
    });
  });

  it('should format P2002 unique constraint violation as 409 Conflict without target field', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Unique constraint violation',
      error: 'Conflict',
    });
  });

  it('should format P2003 foreign key constraint error as 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
      code: 'P2003',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Foreign key constraint violation',
      error: 'Bad Request',
    });
  });

  it('should format P2025 record not found error as 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Record not found',
      error: 'Not Found',
    });
  });

  it('should format P2000 value too long error as 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Value too long', {
      code: 'P2000',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Provided value is too long for the column',
      error: 'Bad Request',
    });
  });

  it('should format P2001 record does not exist as 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record does not exist', {
      code: 'P2001',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Record not found',
      error: 'Not Found',
    });
  });

  it('should format P2014 relation constraint violation as 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Relation violation', {
      code: 'P2014',
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Required relation constraint violation',
      error: 'Bad Request',
    });
  });

  it('should sanitize unknown Prisma known error code to 500 without leaking raw SQL', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'SELECT * FROM users WHERE raw_sql_leak',
      {
        code: 'P9999',
        clientVersion: '5.22.0',
      },
    );

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database operation failed',
      error: 'Internal Server Error',
    });
  });

  it('should format PrismaClientValidationError as 400 Bad Request', () => {
    const error = new Prisma.PrismaClientValidationError('Invalid field input', {
      clientVersion: '5.22.0',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid database query parameters',
      error: 'Bad Request',
    });
  });

  it('should handle unhandled database errors with 500 and generic message', () => {
    const error = new Error('Database connection unexpectedly dropped');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal database error',
      error: 'Internal Server Error',
    });
  });
});
