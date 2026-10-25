import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { createValidationPipe, formatValidationErrors } from './validation.pipe';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreateProjectDto } from '../../projects/dto/create-project.dto';

describe('createValidationPipe & formatValidationErrors', () => {
  const pipe = createValidationPipe();

  it('should validate valid LoginDto successfully', async () => {
    const validData = {
      email: 'user@example.com',
      password: 'password123',
    };

    const result = await pipe.transform(validData, {
      type: 'body',
      metatype: LoginDto,
    });

    expect(result).toBeInstanceOf(LoginDto);
    expect(result.email).toBe(validData.email);
    expect(result.password).toBe(validData.password);
  });

  it('should reject non-whitelisted properties with 400 Bad Request', async () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'password123',
      maliciousField: 'evil-payload',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);

    try {
      await pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      });
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
        error: string;
      };
      expect(response.statusCode).toBe(400);
      expect(response.error).toBe('Bad Request');
      expect(
        response.message.some((m) => m.includes('property maliciousField should not exist')),
      ).toBe(true);
    }
  });

  it('should reject invalid email and short password with formatted error messages', async () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'short',
    };

    try {
      await pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      });
      fail('Expected pipe to throw BadRequestException');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
        error: string;
      };
      expect(response.statusCode).toBe(400);
      expect(response.error).toBe('Bad Request');
      expect(Array.isArray(response.message)).toBe(true);
      expect(response.message.some((m) => m.includes('email must be an email'))).toBe(true);
      expect(
        response.message.some((m) =>
          m.includes('password must be longer than or equal to 8 characters'),
        ),
      ).toBe(true);
    }
  });

  it('should transform types and validate CreateProjectDto', async () => {
    const validProject = {
      name: 'Soroban Security Protocol',
      description: 'Automated audit tool',
      network: 'testnet',
    };

    const transformed = await pipe.transform(validProject, {
      type: 'body',
      metatype: CreateProjectDto,
    });

    expect(transformed).toBeInstanceOf(CreateProjectDto);
    expect(transformed.name).toBe(validProject.name);
  });

  it('formatValidationErrors should recursively traverse nested validation errors', () => {
    const mockErrors: ValidationError[] = [
      {
        property: 'root',
        constraints: { isString: 'root must be a string' },
      } as unknown as ValidationError,
      {
        property: 'nested',
        children: [
          {
            property: 'child',
            constraints: { isNotEmpty: 'child should not be empty' },
          } as unknown as ValidationError,
        ],
      } as unknown as ValidationError,
    ];

    const messages = formatValidationErrors(mockErrors);
    expect(messages).toEqual(['root must be a string', 'child should not be empty']);
  });
});
