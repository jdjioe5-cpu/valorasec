import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationDto {
  read?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, queryOrPage: NotificationQueryDto | number = 1, limitArg?: number) {
    const pageDto =
      typeof queryOrPage === 'number'
        ? Object.assign(new PaginationDto(), { page: queryOrPage, limit: limitArg ?? 20 })
        : Object.assign(new PaginationDto(), queryOrPage);

    const skip = pageDto.getSkip();
    const limit = pageDto.getLimit();
    const orderBy = pageDto.getOrderBy(['createdAt'], 'createdAt');

    const where: Record<string, unknown> = { userId };
    if (typeof (queryOrPage as NotificationQueryDto)?.read === 'boolean') {
      where.read = (queryOrPage as NotificationQueryDto).read;
    }
    if (pageDto.search) {
      where.OR = [
        { title: { contains: pageDto.search, mode: 'insensitive' } },
        { message: { contains: pageDto.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: pageDto.buildMeta(total),
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
}
