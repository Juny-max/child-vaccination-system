import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum StaffRole {
  NURSE = 'facility-nurse',
  CHW = 'chw',
}

export class RegisterStaffDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsUUID()
  catchmentAreaId?: string; // Required for CHWs, optional for nurses

  @IsOptional()
  @IsString()
  specialization?: string; // For nurses only
}
