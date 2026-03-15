import { IsEmail, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';

export enum StaffStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsUUID()
  catchmentAreaId?: string; // For CHWs

  @IsOptional()
  @IsString()
  specialization?: string; // For nurses
}

export class UpdateStaffStatusDto {
  @IsEnum(StaffStatus)
  status: StaffStatus;
}
