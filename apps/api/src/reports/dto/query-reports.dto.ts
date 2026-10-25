import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryReportsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'proj-123', description: 'Filter reports by project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
