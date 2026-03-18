import { IsEmail, IsOptional, IsString, IsUUID, IsEnum, MaxLength } from 'class-validator';

export enum StaffStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @IsOptional()
  @IsUUID()
  catchmentAreaId?: string; // For CHWs

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string; // For nurses
}

export class UpdateStaffStatusDto {
  @IsEnum(StaffStatus)
  status: StaffStatus;
}
