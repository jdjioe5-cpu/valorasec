import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../../projects/projects.service';
import { ScansService } from '../../scans/scans.service';
import { ReportsService } from '../../reports/reports.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaginationDto } from './pagination.dto';
import {
  createPrismaMock,
  createMockProject,
  createMockScan,
  createMockReport,
  createMockNotification,
} from '@valorasec/test-utils';

describe('Consistent Pagination, Filtering, and Sorting across List Endpoints (Issue #20)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let projectsService: ProjectsService;
  let scansService: ScansService;
  let reportsService: ReportsService;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        ProjectsService,
        ScansService,
        ReportsService,
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    projectsService = moduleFixture.get<ProjectsService>(ProjectsService);
    scansService = moduleFixture.get<ScansService>(ScansService);
    reportsService = moduleFixture.get<ReportsService>(ReportsService);
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Projects list endpoint (/api/projects)', () => {
    it('returns standardized data and meta with pagination and sorting', async () => {
      const mockProjects = [createMockProject({ id: 'p1', name: 'Alpha' })];
      prisma.project.findMany.mockResolvedValue(mockProjects);
      prisma.project.count.mockResolvedValue(25);

      const query: PaginationDto = Object.assign(new PaginationDto(), {
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc' as const,
        search: 'Alpha',
      });

      const res = await projectsService.findAll('user-1', query);

      expect(res.data).toEqual(mockProjects);
      expect(res.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { name: 'asc' },
          where: expect.objectContaining({
            userId: 'user-1',
            OR: expect.arrayContaining([{ name: { contains: 'Alpha', mode: 'insensitive' } }]),
          }),
        }),
      );
    });

    it('enforces maximum page size of 100 on projects', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);

      const query = Object.assign(new PaginationDto(), { limit: 250 });
      const res = await projectsService.findAll('user-1', query);

      expect(res.meta.limit).toBe(100);
      expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe('2. Scans history list endpoint (/api/contracts/:id/scans)', () => {
    it('returns standardized data and meta with pagination and custom sorting', async () => {
      const mockScans = [createMockScan({ id: 's1' })];
      prisma.scan.findMany.mockResolvedValue(mockScans);
      prisma.scan.count.mockResolvedValue(15);

      const query = Object.assign(new PaginationDto(), {
        page: 2,
        limit: 5,
        sortBy: 'duration',
        sortOrder: 'asc' as const,
      });

      const res = await scansService.getHistory('contract-1', query);

      expect(res.data).toEqual(mockScans);
      expect(res.meta).toEqual({
        total: 15,
        page: 2,
        limit: 5,
        totalPages: 3,
      });

      expect(prisma.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { duration: 'asc' },
          where: { contractId: 'contract-1' },
        }),
      );
    });
  });

  describe('3. Reports list endpoint (/api/reports)', () => {
    it('returns standardized data and meta with title search and pagination', async () => {
      const mockReports = [createMockReport({ id: 'r1', title: 'Audit Report 1' })];
      prisma.report.findMany.mockResolvedValue(mockReports);
      prisma.report.count.mockResolvedValue(8);

      const query = Object.assign(new PaginationDto(), {
        page: 1,
        limit: 10,
        search: 'Audit',
        sortBy: 'title',
        sortOrder: 'desc' as const,
      });

      const res = await reportsService.findAll(query);

      expect(res.data).toEqual(mockReports);
      expect(res.meta).toEqual({
        total: 8,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'desc' },
          where: expect.objectContaining({
            title: { contains: 'Audit', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('4. Notifications list endpoint (/api/notifications)', () => {
    it('returns standardized data and meta with search and read filter', async () => {
      const mockNotifs = [createMockNotification({ id: 'n1', title: 'Alert' })];
      prisma.notification.findMany.mockResolvedValue(mockNotifs);
      prisma.notification.count.mockResolvedValue(30);

      const query = Object.assign(new PaginationDto(), {
        page: 2,
        limit: 15,
        search: 'Alert',
        read: false,
      });

      const res = await notificationsService.findAll('user-1', query);

      expect(res.data).toEqual(mockNotifs);
      expect(res.meta).toEqual({
        total: 30,
        page: 2,
        limit: 15,
        totalPages: 2,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 15,
          take: 15,
          where: expect.objectContaining({
            userId: 'user-1',
            read: false,
            OR: expect.arrayContaining([{ title: { contains: 'Alert', mode: 'insensitive' } }]),
          }),
        }),
      );
    });
  });
});
