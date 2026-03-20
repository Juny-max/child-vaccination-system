import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBranchCatchmentAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsObject()
  boundaries: Record<string, any>;
}

export class AssignBranchCatchmentAreaDto {
  @IsUUID()
  chwId: string;
}

export class UpdateBranchCatchmentAreaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  boundaries?: Record<string, any>;
}
