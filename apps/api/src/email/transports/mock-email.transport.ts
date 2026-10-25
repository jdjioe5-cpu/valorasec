import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EmailOptions, EmailSendResult, EmailTransport } from '../email.types';

@Injectable()
export class MockEmailTransport implements EmailTransport {
  private sentEmails: Array<EmailOptions & { messageId: string; sentAt: Date }> = [];

  async send(options: EmailOptions): Promise<EmailSendResult> {
    const messageId = `mock-${randomUUID()}`;
    this.sentEmails.push({
      ...options,
      messageId,
      sentAt: new Date(),
    });

    return {
      messageId,
      success: true,
    };
  }

  getSentEmails(): Array<EmailOptions & { messageId: string; sentAt: Date }> {
    return [...this.sentEmails];
  }

  getLastEmail(): (EmailOptions & { messageId: string; sentAt: Date }) | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
  }
}
