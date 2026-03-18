import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateHqSystemSettingDto {
  @IsNotEmpty()
  // Value can be string, number, boolean, or null - validated at runtime by IsNotEmpty
  value: string | number | boolean | null;

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
  // Value can be string, number, boolean, or null - validated at runtime by IsNotEmpty
  value: string | number | boolean | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
