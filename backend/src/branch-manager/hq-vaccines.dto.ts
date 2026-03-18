import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHqVaccineDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;
}

export class UpdateHqVaccineDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateHqScheduleDto {
  @IsUUID()
  vaccineId: string;

  @IsNumber()
  doseNumber: number;

  @IsString()
  @IsNotEmpty()
  scheduleName: string;

  @IsNumber()
  dueDaysFromBirth: number;

  @IsOptional()
  @IsNumber()
  minAgeDays?: number;

  @IsOptional()
  @IsNumber()
  maxAgeDays?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateHqScheduleDto {
  @IsOptional()
  @IsNumber()
  doseNumber?: number;

  @IsOptional()
  @IsString()
  scheduleName?: string;

  @IsOptional()
  @IsNumber()
  dueDaysFromBirth?: number;

  @IsOptional()
  @IsNumber()
  minAgeDays?: number;

  @IsOptional()
  @IsNumber()
  maxAgeDays?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
