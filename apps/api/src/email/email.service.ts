import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailOptions,
  EmailSendResult,
  EmailTransport,
  EMAIL_TRANSPORT,
  ScanCompletedData,
  ReportPublishedData,
  VerificationCompletedData,
} from './email.types';
import { renderScanCompletedEmail } from './templates/scan-completed.template';
import { renderReportPublishedEmail } from './templates/report-published.template';
import { renderVerificationCompletedEmail } from './templates/verification-completed.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  private getAppUrl(): string {
    return this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  async getOrCreatePreferences(userId: string) {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          scanCompleted: true,
          reportPublished: true,
          verificationUpdates: true,
        },
      });
    }

    return pref;
  }

  async updatePreferences(
    userId: string,
    data: { scanCompleted?: boolean; reportPublished?: boolean; verificationUpdates?: boolean },
  ) {
    await this.getOrCreatePreferences(userId);
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  async unsubscribeByToken(token: string, type?: string) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!pref) {
      return null;
    }

    const updateData: {
      scanCompleted?: boolean;
      reportPublished?: boolean;
      verificationUpdates?: boolean;
    } = {};

    if (!type || type === 'all') {
      updateData.scanCompleted = false;
      updateData.reportPublished = false;
      updateData.verificationUpdates = false;
    } else if (type === 'scanCompleted') {
      updateData.scanCompleted = false;
    } else if (type === 'reportPublished') {
      updateData.reportPublished = false;
    } else if (type === 'verificationUpdates') {
      updateData.verificationUpdates = false;
    }

    return this.prisma.notificationPreference.update({
      where: { id: pref.id },
      data: updateData,
    });
  }

  async sendMail(options: EmailOptions): Promise<EmailSendResult> {
    try {
      return await this.transport.send(options);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { success: false, messageId: '' };
    }
  }

  async sendScanCompletedEmail(
    userId: string,
    data: Omit<ScanCompletedData, 'userName' | 'unsubscribeUrl'>,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const pref = await this.getOrCreatePreferences(userId);
    if (!pref.scanCompleted) {
      this.logger.debug(`User ${userId} opted out of scan completion emails`);
      return false;
    }

    const appUrl = this.getAppUrl();
    const unsubscribeUrl = `${appUrl}/settings?unsubscribe=${pref.unsubscribeToken}&type=scanCompleted`;

    const { subject, html, text } = renderScanCompletedEmail({
      ...data,
      userName: user.name,
      unsubscribeUrl,
    });

    const res = await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });

    return res.success;
  }

  async sendReportPublishedEmail(
    userId: string,
    data: Omit<ReportPublishedData, 'userName' | 'unsubscribeUrl'>,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const pref = await this.getOrCreatePreferences(userId);
    if (!pref.reportPublished) {
      this.logger.debug(`User ${userId} opted out of report published emails`);
      return false;
    }

    const appUrl = this.getAppUrl();
    const unsubscribeUrl = `${appUrl}/settings?unsubscribe=${pref.unsubscribeToken}&type=reportPublished`;

    const { subject, html, text } = renderReportPublishedEmail({
      ...data,
      userName: user.name,
      unsubscribeUrl,
    });

    const res = await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });

    return res.success;
  }

  async sendVerificationCompletedEmail(
    userId: string,
    data: Omit<VerificationCompletedData, 'userName' | 'unsubscribeUrl'>,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const pref = await this.getOrCreatePreferences(userId);
    if (!pref.verificationUpdates) {
      this.logger.debug(`User ${userId} opted out of verification updates emails`);
      return false;
    }

    const appUrl = this.getAppUrl();
    const unsubscribeUrl = `${appUrl}/settings?unsubscribe=${pref.unsubscribeToken}&type=verificationUpdates`;

    const { subject, html, text } = renderVerificationCompletedEmail({
      ...data,
      userName: user.name,
      unsubscribeUrl,
    });

    const res = await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });

    return res.success;
  }
}
