import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHqCatchmentAreaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsOptional()
  @IsString()
  community?: string;

  @IsOptional()
  @IsNumber()
  populationEstimate?: number;

  @IsOptional()
  @IsUUID()
  assignedChwId?: string;
}

export class UpdateHqCatchmentAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  community?: string;

  @IsOptional()
  @IsNumber()
  populationEstimate?: number;

  @IsOptional()
  @IsUUID()
  assignedChwId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
