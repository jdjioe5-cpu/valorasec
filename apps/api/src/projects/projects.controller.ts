import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import type { Request } from 'express';

interface JwtRequest extends Request {
  user: { sub: string };
}

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects for current user' })
  async findAll(@Req() req: JwtRequest, @Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  async findOne(@Req() req: JwtRequest, @Param('id') id: string) {
    const project = await this.projectsService.findOne(req.user.sub, id);
    return { data: project };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async create(@Req() req: JwtRequest, @Body() dto: CreateProjectDto) {
    const project = await this.projectsService.create(req.user.sub, dto);
    return { data: project };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project details' })
  async update(@Req() req: JwtRequest, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    const project = await this.projectsService.update(req.user.sub, id, dto);
    return { data: project };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Soft-delete (archive) a project' })
  async archive(@Req() req: JwtRequest, @Param('id') id: string) {
    const project = await this.projectsService.archive(req.user.sub, id);
    return { data: project };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore an archived project within 30-day window' })
  async restore(@Req() req: JwtRequest, @Param('id') id: string) {
    const project = await this.projectsService.restore(req.user.sub, id);
    return { data: project };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  async remove(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.projectsService.remove(req.user.sub, id);
    return { data: { message: 'Project deleted' } };
  }
}
