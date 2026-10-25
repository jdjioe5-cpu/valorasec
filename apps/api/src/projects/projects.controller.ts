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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProjectsService, ProjectQueryDto } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
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
  @ApiOperation({
    summary: 'List all projects for current user with pagination, sorting, and search',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'network', required: false, type: String })
  async findAll(@Req() req: JwtRequest, @Query() query: ProjectQueryDto) {
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  async remove(@Req() req: JwtRequest, @Param('id') id: string) {
    await this.projectsService.remove(req.user.sub, id);
    return { data: { message: 'Project deleted successfully' } };
  }
}
