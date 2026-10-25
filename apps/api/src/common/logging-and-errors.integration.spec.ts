import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { createPrismaMock } from '../../test/test-setup';

describe('Comprehensive Error Handling and Logging (Integration)', () => {
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
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format 404 Not Found consistently with X-Request-Id header', async () => {
    const res = await request(app.getHttpServer()).get('/api/non-existent-endpoint').expect(404);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        path: '/api/non-existent-endpoint',
        method: 'GET',
        requestId: res.headers['x-request-id'],
        error: 'Not Found',
      }),
    );
    expect(res.body.timestamp).toBeDefined();
  });

  it('should format 401 Unauthorized consistently when missing JWT token', async () => {
    const res = await request(app.getHttpServer()).get('/api/projects').expect(401);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        path: '/api/projects',
        method: 'GET',
        requestId: res.headers['x-request-id'],
        message: 'Unauthorized',
        error: 'Unauthorized',
      }),
    );
  });

  it('should format 400 Validation Error consistently when sending malformed payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'bad-email' })
      .expect(400);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/auth/login',
        method: 'POST',
        requestId: res.headers['x-request-id'],
        error: 'Bad Request',
      }),
    );
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('should preserve incoming X-Request-Id from caller', async () => {
    const customRequestId = 'client-trace-7788';
    const res = await request(app.getHttpServer())
      .get('/api/projects')
      .set('X-Request-Id', customRequestId)
      .expect(401);

    expect(res.headers['x-request-id']).toBe(customRequestId);
    expect(res.body.requestId).toBe(customRequestId);
  });
});
