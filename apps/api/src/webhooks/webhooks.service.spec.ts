import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockWebhook } from '@valorasec/test-utils';
import * as crypto from 'crypto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [WebhooksService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('findAll', () => {
    it('should list all webhooks for user', async () => {
      const mockWebhooks = [
        createMockWebhook({ id: 'wh-1', userId: 'user-1' }),
        createMockWebhook({ id: 'wh-2', userId: 'user-1' }),
      ];
      prisma.webhook.findMany.mockResolvedValue(mockWebhooks);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.webhook.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          deliveries: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return webhook by id', async () => {
      const mock = createMockWebhook({ id: 'wh-1', userId: 'user-1' });
      prisma.webhook.findFirst.mockResolvedValue(mock);

      const result = await service.findById('user-1', 'wh-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundException if webhook does not exist', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.findById('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should generate a secret if not provided', async () => {
      prisma.webhook.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'wh-new',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          ...data,
        }),
      );

      const result = await service.create('user-1', {
        url: 'https://security.example.com/alerts',
        description: 'Ops alert',
      });

      expect(result.url).toBe('https://security.example.com/alerts');
      expect(result.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
      expect(result.events).toContain('scan.completed');
    });

    it('should use provided secret if given', async () => {
      prisma.webhook.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'wh-custom',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          ...data,
        }),
      );

      const result = await service.create('user-1', {
        url: 'https://security.example.com/alerts',
        secret: 'my-custom-secret-key',
      });

      expect(result.secret).toBe('my-custom-secret-key');
    });
  });

  describe('delete', () => {
    it('should delete existing webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue(
        createMockWebhook({ id: 'wh-1', userId: 'user-1' }),
      );
      prisma.webhook.delete.mockResolvedValue({});

      const res = await service.delete('user-1', 'wh-1');

      expect(res.message).toBe('Webhook deleted successfully');
      expect(prisma.webhook.delete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
    });

    it('should throw NotFoundException when deleting non-existent webhook', async () => {
      prisma.webhook.findFirst.mockResolvedValue(null);

      await expect(service.delete('user-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('computeSignature', () => {
    it('should generate valid HMAC-SHA256 signature', () => {
      const secret = 'whsec_secret123';
      const timestamp = '1700000000000';
      const payload = JSON.stringify({ hello: 'world' });

      const sig = service.computeSignature(payload, secret, timestamp);

      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      expect(sig).toBe(expected);
    });
  });

  describe('deliverPayload & retry logic', () => {
    it('should deliver successfully on first attempt when 200 OK', async () => {
      const webhook = { id: 'wh-1', url: 'https://webhook.site/test', secret: 'whsec_key' };
      const payload = { event: 'scan.completed', data: { score: 95 } };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      prisma.webhookDelivery.create.mockResolvedValue({});

      const result = await service.deliverPayload(webhook, 'scan.completed', payload, {
        maxRetries: 3,
        initialBackoffMs: 10,
      });

      expect(result.status).toBe('success');
      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify headers passed
      const fetchCallArgs = mockFetch.mock.calls[0];
      const headers = fetchCallArgs[1].headers;
      expect(headers['X-ValoraSec-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(headers['X-ValoraSec-Timestamp']).toBeDefined();
      expect(headers['X-ValoraSec-Event']).toBe('scan.completed');

      expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookId: 'wh-1',
            status: 'success',
            statusCode: 200,
            attempts: 1,
          }),
        }),
      );
    });

    it('should retry up to 3 times with exponential backoff on failure', async () => {
      const webhook = { id: 'wh-2', url: 'https://broken.server/hook', secret: 'whsec_fail' };
      const payload = { test: true };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      prisma.webhookDelivery.create.mockResolvedValue({});

      const result = await service.deliverPayload(webhook, 'scan.completed', payload, {
        maxRetries: 3,
        initialBackoffMs: 10, // 10ms for fast test execution
      });

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(500);
      expect(result.attempts).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookId: 'wh-2',
            status: 'failed',
            statusCode: 500,
            attempts: 3,
          }),
        }),
      );
    });
  });

  describe('dispatchScanCompleted', () => {
    it('should query active webhooks and trigger deliveries', async () => {
      const mockWebhooks = [
        createMockWebhook({
          id: 'wh-1',
          userId: 'user-1',
          isActive: true,
          events: ['scan.completed'],
        }),
      ];
      prisma.webhook.findMany.mockResolvedValue(mockWebhooks);

      const deliverSpy = jest.spyOn(service, 'deliverPayload').mockResolvedValue({
        status: 'success',
        statusCode: 200,
        attempts: 1,
      });

      await service.dispatchScanCompleted('user-1', {
        projectId: 'p1',
        contractId: 'c1',
        scanId: 's1',
        status: 'completed',
        summary: {},
        findingsCount: 0,
      });

      expect(prisma.webhook.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
      });
      expect(deliverSpy).toHaveBeenCalledWith(
        mockWebhooks[0],
        'scan.completed',
        expect.objectContaining({ event: 'scan.completed' }),
      );
    });
  });
});
