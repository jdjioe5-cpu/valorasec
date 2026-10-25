import { IsString, IsUrl, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhook', description: 'Webhook delivery endpoint' })
  @IsUrl()
  url!: string;

  @ApiProperty({ example: 'Security team alert endpoint', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'whsec_custom_secret', required: false })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiProperty({ example: ['scan.completed'], required: false })
  @IsOptional()
  @IsArray()
  events?: string[];
}
