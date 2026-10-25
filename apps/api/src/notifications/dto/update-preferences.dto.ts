import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  scanCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  reportPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  verificationUpdates?: boolean;
}
