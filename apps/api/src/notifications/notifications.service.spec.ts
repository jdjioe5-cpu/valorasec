import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, createMockNotification } from '@valorasec/test-utils';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────

  describe('findAll', () => {
    const mockNotifications = [
      createMockNotification({ id: 'notif-1', type: 'scan_complete' }),
      createMockNotification({ id: 'notif-2', type: 'report_ready' }),
      createMockNotification({ id: 'notif-3', type: 'verification' }),
    ];

    it('should return paginated notifications for user', async () => {
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.findAll('user-1');

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should paginate with custom page and limit', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(45);

      const result = await service.findAll('user-1', 3, 10);

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });

    it('should return empty data when no notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.findAll('user-1');

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── markRead ──────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markRead('user-1', 'notif-1');

      expect(result.count).toBe(1);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { read: true },
      });
    });

    it('should return count 0 when notification does not belong to user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markRead('user-2', 'notif-1');

      expect(result.count).toBe(0);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-2' },
        data: { read: true },
      });
    });
  });

  // ─── markAllRead ───────────────────────────────────────────────────────

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('user-1');

      expect(result.count).toBe(5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });

    it('should return count 0 when no unread notifications', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllRead('user-1');

      expect(result.count).toBe(0);
    });
  });

  // ─── getPreferences ────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('should return default preferences when email service not provided', async () => {
      const prefs = await service.getPreferences('user-1');
      expect(prefs.scanCompleted).toBe(true);
      expect(prefs.reportPublished).toBe(true);
      expect(prefs.verificationUpdates).toBe(true);
    });
  });

  // ─── updatePreferences ─────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('should return updated preferences when email service not provided', async () => {
      const prefs = await service.updatePreferences('user-1', { scanCompleted: false });
      expect(prefs.scanCompleted).toBe(false);
    });
  });

  // ─── unsubscribe ───────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('should return success response', async () => {
      const res = await service.unsubscribe('any-token');
      expect(res.success).toBe(true);
    });
  });
});
