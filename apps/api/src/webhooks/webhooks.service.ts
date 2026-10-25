import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import * as crypto from 'crypto';

export interface DeliveryResult {
  status: 'success' | 'failed';
  statusCode?: number;
  attempts: number;
  error?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findById(userId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, userId },
      include: {
        deliveries: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  async create(userId: string, dto: CreateWebhookDto) {
    const secret = dto.secret?.trim() || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const events = dto.events && dto.events.length > 0 ? dto.events : ['scan.completed'];

    return this.prisma.webhook.create({
      data: {
        userId,
        url: dto.url,
        description: dto.description,
        secret,
        events,
      },
    });
  }

  async delete(userId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, userId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.webhook.delete({
      where: { id },
    });

    return { message: 'Webhook deleted successfully' };
  }

  async findDeliveries(userId: string, webhookId: string) {
    // Verify ownership
    await this.findById(userId, webhookId);

    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  computeSignature(payloadString: string, secret: string, timestamp: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payloadString}`)
      .digest('hex');
  }

  async deliverPayload(
    webhook: { id: string; url: string; secret: string },
    event: string,
    payload: Record<string, unknown>,
    options: { maxRetries?: number; initialBackoffMs?: number } = {},
  ): Promise<DeliveryResult> {
    const maxRetries = options.maxRetries ?? 3;
    const initialBackoffMs = options.initialBackoffMs ?? 500;

    const payloadString = JSON.stringify(payload);
    let attempts = 0;
    let lastStatusCode: number | undefined;
    let lastError: string | undefined;
    let success = false;

    while (attempts < maxRetries && !success) {
      attempts++;
      const timestamp = Date.now().toString();
      const signature = this.computeSignature(payloadString, webhook.secret, timestamp);

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-ValoraSec-Signature': `sha256=${signature}`,
            'X-ValoraSec-Timestamp': timestamp,
            'X-ValoraSec-Event': event,
          },
          body: payloadString,
          signal: AbortSignal.timeout(5000),
        });

        lastStatusCode = response.status;
        if (response.ok) {
          success = true;
          break;
        } else {
          lastError = `HTTP error ${response.status}: ${response.statusText}`;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      // Exponential backoff if more attempts remain
      if (!success && attempts < maxRetries) {
        const delayMs = initialBackoffMs * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const deliveryStatus = success ? 'success' : 'failed';

    // Record delivery status
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as unknown as object,
        status: deliveryStatus,
        statusCode: lastStatusCode ?? null,
        attempts,
        error: success ? null : (lastError ?? 'Unknown error'),
      },
    });

    return {
      status: deliveryStatus,
      statusCode: lastStatusCode,
      attempts,
      error: success ? undefined : lastError,
    };
  }

  async testWebhook(userId: string, id: string, initialBackoffMs?: number) {
    const webhook = await this.findById(userId, id);
    const testPayload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      message: 'This is a test notification from ValoraSec security pipeline.',
      webhookId: webhook.id,
    };

    return this.deliverPayload(webhook, 'ping', testPayload, {
      maxRetries: 3,
      initialBackoffMs: initialBackoffMs ?? 50,
    });
  }

  async dispatchScanCompleted(
    userId: string,
    data: {
      projectId: string;
      contractId: string;
      scanId: string;
      status: string;
      summary: unknown;
      findingsCount: number;
    },
  ) {
    try {
      const webhooks = await this.prisma.webhook.findMany({
        where: { userId, isActive: true },
      });

      const payload = {
        event: 'scan.completed',
        timestamp: new Date().toISOString(),
        data,
      };

      for (const webhook of webhooks) {
        const events = Array.isArray(webhook.events) ? (webhook.events as string[]) : [];
        if (events.length === 0 || events.includes('scan.completed')) {
          // Fire delivery with background error logging
          this.deliverPayload(webhook, 'scan.completed', payload).catch((err) => {
            this.logger.warn(
              `Failed background webhook delivery for ${webhook.id}: ${err.message}`,
            );
          });
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `Error querying webhooks for scan completion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
