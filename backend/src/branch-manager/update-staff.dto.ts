import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, IsEnum, MaxLength } from 'class-validator';

const optionalTrimmedString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export enum StaffStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export class UpdateStaffDto {
  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsUUID()
  catchmentAreaId?: string; // For CHWs

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(100)
  specialization?: string; // For nurses
}

export class UpdateStaffStatusDto {
  @IsEnum(StaffStatus)
  status: StaffStatus;
}
