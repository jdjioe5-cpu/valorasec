import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, mockProject } from '../../test/test-setup';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const userId = 'user-1';
  const projectId = 'project-1';

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('excludes archived projects by default', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);

      await service.findAll(userId, {});

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: { not: 'archived' },
          }),
        }),
      );
    });

    it('includes archived projects when includeArchived is true', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);

      await service.findAll(userId, { includeArchived: true });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            status: { not: 'archived' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns project if found and owned by user', async () => {
      const proj = mockProject({ id: projectId, userId });
      prisma.project.findFirst.mockResolvedValue(proj);

      const result = await service.findOne(userId, projectId);
      expect(result).toEqual(proj);
    });

    it('throws NotFoundException if project not found', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, projectId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('sets status to archived and records archivedAt', async () => {
      const proj = mockProject({ id: projectId, userId, status: 'active', archivedAt: null });
      prisma.project.findFirst.mockResolvedValue(proj);
      prisma.project.update.mockResolvedValue({
        ...proj,
        status: 'archived',
        archivedAt: new Date(),
      });

      const result = await service.archive(userId, projectId);

      expect(result.status).toBe('archived');
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: projectId },
          data: expect.objectContaining({
            status: 'archived',
            archivedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws BadRequestException if already archived', async () => {
      const proj = mockProject({
        id: projectId,
        userId,
        status: 'archived',
        archivedAt: new Date(),
      });
      prisma.project.findFirst.mockResolvedValue(proj);

      await expect(service.archive(userId, projectId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('restore', () => {
    it('restores archived project within 30-day window', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const proj = mockProject({
        id: projectId,
        userId,
        status: 'archived',
        archivedAt: tenDaysAgo,
      });
      prisma.project.findFirst.mockResolvedValue(proj);
      prisma.project.update.mockResolvedValue({ ...proj, status: 'active', archivedAt: null });

      const result = await service.restore(userId, projectId);

      expect(result.status).toBe('active');
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: projectId },
          data: {
            status: 'active',
            archivedAt: null,
          },
        }),
      );
    });

    it('throws BadRequestException if recovery window has expired (>30 days)', async () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const proj = mockProject({
        id: projectId,
        userId,
        status: 'archived',
        archivedAt: thirtyFiveDaysAgo,
      });
      prisma.project.findFirst.mockResolvedValue(proj);

      await expect(service.restore(userId, projectId)).rejects.toThrow(
        'Cannot restore: 30-day recovery window has expired',
      );
    });

    it('throws BadRequestException if project is not archived', async () => {
      const proj = mockProject({ id: projectId, userId, status: 'active', archivedAt: null });
      prisma.project.findFirst.mockResolvedValue(proj);

      await expect(service.restore(userId, projectId)).rejects.toThrow(BadRequestException);
    });
  });
});
