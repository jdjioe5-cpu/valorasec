import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { createValidationPipe } from './pipes/validation.pipe';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { createPrismaMock } from '../../test/test-setup';

describe('Global Validation and Exception Filters (Integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AuthModule,
        ProjectsModule,
        PrismaModule,
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Global ValidationPipe Behavior', () => {
    it('should reject malformed email format on /api/auth/login with standardized error structure', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'invalid-email-address',
          password: 'validPassword123',
        })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: expect.arrayContaining([expect.stringContaining('email must be an email')]),
        error: 'Bad Request',
      });
    });

    it('should reject short passwords on /api/auth/login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@valorasec.dev',
          password: '123',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('password must be longer than or equal to 8 characters');
    });

    it('should forbid and reject unexpected properties (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@valorasec.dev',
          password: 'password123',
          role: 'ADMIN_INJECTION',
          unknownField: true,
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(
        res.body.message.some((m: string) => m.includes('property role should not exist')),
      ).toBe(true);
      expect(
        res.body.message.some((m: string) => m.includes('property unknownField should not exist')),
      ).toBe(true);
    });

    it('should reject empty body with missing required fields', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message.length).toBeGreaterThan(0);
    });
  });

  describe('PrismaExceptionFilter Behavior', () => {
    it('should map P2002 Unique Constraint violation to 409 Conflict without leaking raw SQL', async () => {
      // Simulate unique constraint collision during user creation
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`email`) -- raw SQL: INSERT INTO "users"',
          {
            code: 'P2002',
            clientVersion: '5.22.0',
            meta: { target: ['email'] },
          },
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@valorasec.dev',
          password: 'password123',
          name: 'Duplicate User',
        })
        .expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        message: 'Unique constraint violation on field: email',
        error: 'Conflict',
      });
      // Ensure no raw SQL was leaked to client
      expect(JSON.stringify(res.body)).not.toContain('INSERT INTO');
      expect(JSON.stringify(res.body)).not.toContain('raw SQL');
    });

    it('should map unexpected Prisma errors to 500 without leaking database details', async () => {
      prisma.user.findUnique.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'FATAL: connection terminated abruptly during SELECT "user"."id" FROM "users"',
          {
            code: 'P9999',
            clientVersion: '5.22.0',
          },
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'error@valorasec.dev',
          password: 'password123',
          name: 'Error User',
        })
        .expect(500);

      expect(res.body).toEqual({
        statusCode: 500,
        message: 'Database operation failed',
        error: 'Internal Server Error',
      });
      // Ensure no raw SQL was leaked
      expect(JSON.stringify(res.body)).not.toContain('SELECT "user"');
    });
  });
});
