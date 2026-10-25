import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

export class ProjectQueryDto extends PaginationDto {
  network?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: ProjectQueryDto = new PaginationDto()) {
    const pageDto = Object.assign(new PaginationDto(), query);
    const skip = pageDto.getSkip();
    const limit = pageDto.getLimit();
    const orderBy = pageDto.getOrderBy(['name', 'createdAt', 'updatedAt'], 'updatedAt');

    const where: Record<string, unknown> = { userId };
    if (pageDto.search) {
      where.OR = [
        { name: { contains: pageDto.search, mode: 'insensitive' } },
        { description: { contains: pageDto.search, mode: 'insensitive' } },
      ];
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
        orderBy,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      meta: pageDto.buildMeta(total),
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
      data: {
        userId,
        name: data.name,
        description: data.description,
        network: data.network,
      },
    });
  }

  async update(userId: string, projectId: string, data: { name?: string; description?: string }) {
    await this.findOne(userId, projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  async remove(userId: string, projectId: string) {
    await this.findOne(userId, projectId);

    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }
}
