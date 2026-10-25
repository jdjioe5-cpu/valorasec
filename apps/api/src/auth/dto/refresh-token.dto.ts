import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
