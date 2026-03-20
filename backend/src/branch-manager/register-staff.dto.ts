import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const optionalTrimmedString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export enum StaffRole {
  NURSE = 'facility-nurse',
  CHW = 'chw',
}

export class RegisterStaffDto {
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  phoneNumber: string;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(50)
  nationalId?: string;

  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsUUID()
  catchmentAreaId?: string; // Required for CHWs, optional for nurses

  @IsOptional()
  @Transform(optionalTrimmedString)
  @IsString()
  @MaxLength(100)
  specialization?: string; // For nurses only
}
