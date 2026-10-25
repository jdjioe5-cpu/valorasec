import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async getPreferences(userId: string) {
    if (!this.emailService) {
      return {
        scanCompleted: true,
        reportPublished: true,
        verificationUpdates: true,
      };
    }
    const pref = await this.emailService.getOrCreatePreferences(userId);
    return {
      scanCompleted: pref.scanCompleted,
      reportPublished: pref.reportPublished,
      verificationUpdates: pref.verificationUpdates,
      unsubscribeToken: pref.unsubscribeToken,
    };
  }

  async updatePreferences(
    userId: string,
    data: { scanCompleted?: boolean; reportPublished?: boolean; verificationUpdates?: boolean },
  ) {
    if (!this.emailService) {
      return {
        scanCompleted: data.scanCompleted ?? true,
        reportPublished: data.reportPublished ?? true,
        verificationUpdates: data.verificationUpdates ?? true,
      };
    }
    const pref = await this.emailService.updatePreferences(userId, data);
    return {
      scanCompleted: pref.scanCompleted,
      reportPublished: pref.reportPublished,
      verificationUpdates: pref.verificationUpdates,
      unsubscribeToken: pref.unsubscribeToken,
    };
  }

  async unsubscribe(token: string, type?: string) {
    if (!this.emailService) {
      return { success: true, message: 'Unsubscribed' };
    }
    const pref = await this.emailService.unsubscribeByToken(token, type);
    if (!pref) {
      return { success: false, message: 'Invalid or expired unsubscribe token' };
    }
    return { success: true, message: 'Successfully unsubscribed from email notifications' };
  }
}
