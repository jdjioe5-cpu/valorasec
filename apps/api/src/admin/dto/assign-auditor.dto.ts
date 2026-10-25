import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAuditorDto {
  @ApiProperty({ example: 'user-auditor-id', description: 'User ID of the auditor' })
  @IsString()
  @IsNotEmpty()
  auditorId!: string;
}
