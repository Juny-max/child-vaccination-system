import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum StaffRole {
  NURSE = 'facility-nurse',
  CHW = 'chw',
}

export class RegisterStaffDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @IsNotEmpty()
  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsUUID()
  catchmentAreaId?: string; // Required for CHWs, optional for nurses

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string; // For nurses only
}
