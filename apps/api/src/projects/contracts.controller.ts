import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractsService, UploadedContractFile } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContractDto } from './dto/create-contract.dto';

@ApiTags('Projects')
@Controller('projects/:projectId/contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contracts for a project' })
  async findAll(@Param('projectId') projectId: string) {
    const contracts = await this.contractsService.findAll(projectId);
    return { data: contracts };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Add a contract to a project with optional Rust source (.rs)' })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateContractDto,
    @UploadedFile() file?: UploadedContractFile,
  ) {
    const contract = await this.contractsService.create(projectId, dto, file);
    return { data: contract };
  }

  @Delete(':contractId')
  @ApiOperation({ summary: 'Remove a contract from a project' })
  async remove(@Param('projectId') projectId: string, @Param('contractId') contractId: string) {
    await this.contractsService.remove(projectId, contractId);
    return { data: { message: 'Contract removed' } };
  }
}
