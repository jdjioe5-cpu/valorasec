import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({
    example: 'auditor',
    enum: ['user', 'admin', 'auditor'],
    description: 'New role for the user',
  })
  @IsString()
  @IsIn(['user', 'admin', 'auditor'])
  role!: 'user' | 'admin' | 'auditor';
}
