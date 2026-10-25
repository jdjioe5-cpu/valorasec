import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'My Updated Protocol', description: 'Project name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated project description',
    description: 'Project description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
