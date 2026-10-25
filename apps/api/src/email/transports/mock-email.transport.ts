import { Injectable, Logger } from '@nestjs/common';
import { EmailOptions, EmailSendResult, EmailTransport } from '../email.types';

@Injectable()
export class MockEmailTransport implements EmailTransport {
  private readonly logger = new Logger(MockEmailTransport.name);
  private sentEmails: EmailOptions[] = [];

  async send(options: EmailOptions): Promise<EmailSendResult> {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.sentEmails.push({ ...options });
    this.logger.log(
      `[MockEmailTransport] Sent email to ${options.to}: "${options.subject}" (id: ${messageId})`,
    );
    return { success: true, messageId };
  }

  getSentEmails(): EmailOptions[] {
    return [...this.sentEmails];
  }

  getLastEmail(): EmailOptions | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
  }
}
