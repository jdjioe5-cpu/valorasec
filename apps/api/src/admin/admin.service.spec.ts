import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, mockUser, mockProject, createMockReport } from '../../test/test-setup';

describe('AdminService (Unit)', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = moduleRef.get<AdminService>(AdminService);
  });

  describe('listUsers', () => {
    it('should return paginated user list', async () => {
      const mockUsers = [
        mockUser({ id: 'u-1', email: 'u1@example.com', role: 'user' }),
        mockUser({ id: 'u-2', email: 'u2@example.com', role: 'admin' }),
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.listUsers(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter users by role and search term', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listUsers(1, 10, 'auditor', 'alice');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'auditor',
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('listReports', () => {
    it('should list all reports with project, contract, and user details', async () => {
      const reports = [createMockReport({ id: 'rep-1' })];
      prisma.report.findMany.mockResolvedValue(reports);
      prisma.report.count.mockResolvedValue(1);

      const result = await service.listReports(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role and generate role audit log and notification', async () => {
      const targetUser = mockUser({ id: 'user-to-promote', role: 'user' });
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.user.update.mockResolvedValue({ ...targetUser, role: 'auditor' });
      prisma.notification.create.mockResolvedValue({});

      const updated = await service.updateUserRole('admin-1', 'user-to-promote', 'auditor');

      expect(updated.role).toBe('auditor');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-promote' },
        data: { role: 'auditor' },
        select: expect.any(Object),
      });

      // Verify audit notification created for user
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-to-promote',
          type: 'role_changed',
        }),
      });

      // Verify in-memory audit log record
      const logs = service.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].previousRole).toBe('user');
      expect(logs[0].newRole).toBe('auditor');
      expect(logs[0].performedBy).toBe('admin-1');
    });

    it('should throw NotFoundException if target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserRole('admin-1', 'non-existent-user', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignAuditor', () => {
    it('should successfully assign an auditor to a project and notify them', async () => {
      const project = mockProject({ id: 'proj-1', name: 'DeFi Swap' });
      const auditor = mockUser({ id: 'auditor-1', role: 'auditor', name: 'Auditor Bob' });

      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.findUnique.mockResolvedValue(auditor);
      prisma.notification.create.mockResolvedValue({});

      const result = await service.assignAuditor('admin-1', 'proj-1', 'auditor-1');

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('proj-1');
      expect(result.auditorId).toBe('auditor-1');
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'auditor-1',
          type: 'project_assigned',
        }),
      });
    });

    it('should throw BadRequestException if assigned user is regular user', async () => {
      const project = mockProject({ id: 'proj-1' });
      const regularUser = mockUser({ id: 'user-1', role: 'user' });

      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.findUnique.mockResolvedValue(regularUser);

      await expect(service.assignAuditor('admin-1', 'proj-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if project or auditor user not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.assignAuditor('admin-1', 'missing-proj', 'auditor-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
