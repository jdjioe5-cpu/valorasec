import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import * as http from 'http';
import * as crypto from 'crypto';
import { WebhooksModule } from './webhooks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { createPrismaMock, createMockWebhook } from '@valorasec/test-utils';

describe('Webhooks (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;
  let mockReceiver: http.Server;
  let receiverPort: number;
  let lastReceivedHeaders: http.IncomingHttpHeaders | null = null;
  let lastReceivedBody: string = '';

  const userId = 'user-test-webhook';

  beforeAll(async () => {
    // Spin up local mock webhook receiver server
    mockReceiver = http.createServer((req, res) => {
      lastReceivedHeaders = req.headers;
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        lastReceivedBody = body;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>((resolve) => {
      mockReceiver.listen(0, '127.0.0.1', () => {
        const addr = mockReceiver.address();
        receiverPort = typeof addr === 'object' && addr ? addr.port : 8888;
        resolve();
      });
    });

    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        WebhooksModule,
        PrismaModule,
        AuthModule,
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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
    await new Promise<void>((resolve) => mockReceiver.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    lastReceivedHeaders = null;
    lastReceivedBody = '';
  });

  function authHeader(): { Authorization: string } {
    return { Authorization: `Bearer ${jwtService.sign({ sub: userId })}` };
  }

  it('should require authentication for all endpoints', async () => {
    await request(app.getHttpServer()).get('/api/webhooks').expect(401);
    await request(app.getHttpServer()).post('/api/webhooks').expect(401);
    await request(app.getHttpServer()).get('/api/webhooks/1').expect(401);
    await request(app.getHttpServer()).delete('/api/webhooks/1').expect(401);
    await request(app.getHttpServer()).post('/api/webhooks/1/test').expect(401);
  });

  it('should register a new webhook with URL validation', async () => {
    const webhookUrl = `http://127.0.0.1:${receiverPort}/webhook`;

    prisma.webhook.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'wh-created-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        ...data,
      }),
    );

    const res = await request(app.getHttpServer())
      .post('/api/webhooks')
      .set(authHeader())
      .send({
        url: webhookUrl,
        description: 'Mock Receiver',
      })
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.url).toBe(webhookUrl);
    expect(res.body.data.secret).toBeDefined();
    expect(res.body.data.secret).toMatch(/^whsec_/);
  });

  it('should list user webhooks', async () => {
    prisma.webhook.findMany.mockResolvedValue([createMockWebhook({ id: 'wh-1', userId })]);

    const res = await request(app.getHttpServer())
      .get('/api/webhooks')
      .set(authHeader())
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('wh-1');
  });

  it('should deliver test ping to mock receiver and verify HMAC signature', async () => {
    const webhookSecret = 'whsec_test_secret_for_hmac_123456';
    const webhookUrl = `http://127.0.0.1:${receiverPort}/webhook`;

    prisma.webhook.findFirst.mockResolvedValue(
      createMockWebhook({
        id: 'wh-live-1',
        userId,
        url: webhookUrl,
        secret: webhookSecret,
      }),
    );

    prisma.webhookDelivery.create.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .post('/api/webhooks/wh-live-1/test')
      .set(authHeader())
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('success');
    expect(res.body.data.statusCode).toBe(200);

    // Verify what mock receiver got
    expect(lastReceivedHeaders).not.toBeNull();
    const signatureHeader = lastReceivedHeaders!['x-valorasec-signature'] as string;
    const timestampHeader = lastReceivedHeaders!['x-valorasec-timestamp'] as string;
    const eventHeader = lastReceivedHeaders!['x-valorasec-event'] as string;

    expect(eventHeader).toBe('ping');
    expect(signatureHeader).toBeDefined();
    expect(timestampHeader).toBeDefined();

    // Verify HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestampHeader}.${lastReceivedBody}`)
      .digest('hex');

    expect(signatureHeader).toBe(`sha256=${expectedSignature}`);
  });

  it('should delete a webhook', async () => {
    prisma.webhook.findFirst.mockResolvedValue(createMockWebhook({ id: 'wh-del', userId }));
    prisma.webhook.delete.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .delete('/api/webhooks/wh-del')
      .set(authHeader())
      .expect(200);

    expect(res.body.data.message).toBe('Webhook deleted successfully');
  });
});
