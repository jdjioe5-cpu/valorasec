import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_TRANSPORT,
  type EmailOptions,
  type EmailSendResult,
  type EmailTransport,
} from './email.types';
import { renderVerificationEmail } from './templates/verification.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:3000';
  }

  getTransport(): EmailTransport {
    return this.transport;
  }

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    try {
      return await this.transport.send(options);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}:`, err);
      return {
        messageId: '',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<EmailSendResult> {
    const verificationUrl = `${this.appUrl.replace(/\/+$/, '')}/verify?token=${encodeURIComponent(
      token,
    )}`;

    const { subject, html, text } = renderVerificationEmail({
      name,
      verificationUrl,
    });

    this.logger.log(`Sending email verification link to ${to}`);
    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }
}
