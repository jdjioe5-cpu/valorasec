import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({ example: 'custom-auth-check' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Custom Auth Check' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'authorization' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 'high', enum: ['critical', 'high', 'medium', 'low', 'informational'] })
  @IsIn(['critical', 'high', 'medium', 'low', 'informational'])
  severity!: string;

  @ApiProperty({ example: 'Detects missing auth calls' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 'Use require_auth() method' })
  @IsString()
  @IsNotEmpty()
  recommendation!: string;

  @ApiPropertyOptional({ example: 'require_auth\\(' })
  @IsString()
  @IsOptional()
  pattern?: string;
}
