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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { Request, Response } from 'express';

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
  async findAll(
    @Req() req: JwtRequest,
    @Query() query: PaginationDto & { search?: string; network?: string },
  ) {
    return this.projectsService.findAll(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  async findOne(@Req() req: JwtRequest, @Param('id') id: string) {
    const project = await this.projectsService.findOne(req.user.sub, id);
    return { data: project };
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export project data (CSV or JSON)' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async exportProject(
    @Req() req: JwtRequest,
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.projectsService.exportProject(req.user.sub, id, format);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return result.data;
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  async remove(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.projectsService.remove(req.user.sub, id);
    return { data: { message: 'Project deleted' } };
  }
}
