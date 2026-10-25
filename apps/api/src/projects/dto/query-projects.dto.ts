import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryProjectsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'DeFi',
    description: 'Search term for project name or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'testnet', description: 'Filter by Stellar network' })
  @IsOptional()
  @IsString()
  network?: string;
}
