import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHqSystemSettingDto {
  @IsNotEmpty()
  // Value must be a non-empty string, number, or boolean
  value: string | number | boolean;

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
  // Value must be a non-empty string, number, or boolean
  value: string | number | boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
