import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AssignAuditorDto } from './dto/assign-auditor.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string; role?: string };
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: List all registered users' })
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(page, limit, role, search);
  }

  @Get('reports')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Admin/Auditor: List all reports across the platform' })
  async listReports(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listReports(page, limit);
  }

  @Patch('users/:userId/role')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Update user role and create audit log' })
  async updateUserRole(
    @Req() req: JwtRequest,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = await this.adminService.updateUserRole(req.user.sub, targetUserId, dto.role);
    return { data: user };
  }

  @Post('projects/:projectId/assign-auditor')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Assign auditor to project' })
  async assignAuditor(
    @Req() req: JwtRequest,
    @Param('projectId') projectId: string,
    @Body() dto: AssignAuditorDto,
  ) {
    const result = await this.adminService.assignAuditor(req.user.sub, projectId, dto.auditorId);
    return { data: result };
  }
}
