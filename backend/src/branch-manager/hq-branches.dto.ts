import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHqBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  region: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  manager?: string;

  @IsString()
  @IsOptional()
  managerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catchmentAreas?: string[];
}

export class UpdateHqBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  region: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  manager?: string;

  @IsString()
  @IsOptional()
  managerId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catchmentAreas?: string[];
}

export class UpdateHqBranchStatusDto {
  @IsString()
  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive';
}

export class UpdateHqBranchChwsDto {
  @IsArray()
  @IsString({ each: true })
  assignedChws: string[];
}
