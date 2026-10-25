import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RoleAuditLog {
  targetUserId: string;
  previousRole: string;
  newRole: string;
  performedBy: string;
  timestamp: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly auditLogs: RoleAuditLog[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page = 1, limit = 20, role?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (role) {
      where['role'] = role;
    }
    if (search) {
      where['OR'] = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listReports(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true, network: true } },
          contract: { select: { id: true, name: true, address: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.report.count(),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(adminUserId: string, targetUserId: string, newRole: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousRole = user.role;
    if (previousRole === newRole) {
      return user;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Record audit log for role changes
    const logEntry: RoleAuditLog = {
      targetUserId,
      previousRole,
      newRole,
      performedBy: adminUserId,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(logEntry);
    this.logger.log(`Role change audit: ${JSON.stringify(logEntry)}`);

    // Create an audit notification record for the user
    await this.prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'role_changed',
        title: 'Your Account Role Has Changed',
        message: `Your account role was updated from ${previousRole} to ${newRole} by an administrator.`,
        metadata: {
          previousRole,
          newRole,
          updatedBy: adminUserId,
          timestamp: logEntry.timestamp,
        },
      },
    });

    return updatedUser;
  }

  async assignAuditor(adminUserId: string, projectId: string, auditorId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const auditor = await this.prisma.user.findUnique({
      where: { id: auditorId },
    });

    if (!auditor) {
      throw new NotFoundException('Auditor user not found');
    }

    if (auditor.role !== 'auditor' && auditor.role !== 'admin') {
      throw new BadRequestException('Assigned user must hold auditor or admin role');
    }

    // Notify the auditor of the project assignment
    await this.prisma.notification.create({
      data: {
        userId: auditorId,
        type: 'project_assigned',
        title: 'New Project Assigned for Audit',
        message: `You have been assigned as the auditor for project '${project.name}'.`,
        metadata: {
          projectId: project.id,
          projectName: project.name,
          assignedBy: adminUserId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Auditor ${auditorId} assigned to project ${projectId} by ${adminUserId}`);

    return {
      success: true,
      projectId: project.id,
      auditorId: auditor.id,
      auditorName: auditor.name,
      assignedAt: new Date().toISOString(),
    };
  }

  getAuditLogs(): RoleAuditLog[] {
    return [...this.auditLogs];
  }
}
