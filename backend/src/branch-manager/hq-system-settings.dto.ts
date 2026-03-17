import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHqSystemSettingDto {
  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateHqSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
