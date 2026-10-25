import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatProjectCsv } from '../common/export/csv-export.helper';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: { page?: number; limit?: number; search?: string; network?: string },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.network) {
      where.network = query.network;
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: { contracts: true },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { contracts: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(userId: string, data: { name: string; description?: string; network: string }) {
    return this.prisma.project.create({
      data: { ...data, userId },
      include: { contracts: true },
    });
  }

  async update(userId: string, projectId: string, data: { name?: string; description?: string }) {
    await this.findOne(userId, projectId); // verify ownership
    return this.prisma.project.update({
      where: { id: projectId },
      data,
      include: { contracts: true },
    });
  }

  async remove(userId: string, projectId: string) {
    await this.findOne(userId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async exportProject(userId: string, projectId: string, format: string = 'json') {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        contracts: true,
        scans: {
          include: { contract: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const exportFormat = (format || 'json').toLowerCase();
    const sanitizedName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    if (exportFormat === 'csv') {
      const csvData = formatProjectCsv(project);
      return {
        data: csvData,
        filename: `project-${sanitizedName}-${project.id.slice(0, 8)}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    if (exportFormat === 'json') {
      const exportPayload = {
        ...project,
        exportedAt: new Date().toISOString(),
      };
      return {
        data: exportPayload,
        filename: `project-${sanitizedName}-${project.id.slice(0, 8)}.json`,
        mimeType: 'application/json; charset=utf-8',
      };
    }

    throw new BadRequestException(
      `Unsupported export format '${format}'. Supported formats: csv, json`,
    );
  }
}
