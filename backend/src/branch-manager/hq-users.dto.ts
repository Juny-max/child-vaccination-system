import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export const hqUserRoles = [
  'hq-admin',
  'branch-manager',
  'facility-nurse',
  'chw',
] as const;

export type HqUserRole = (typeof hqUserRoles)[number];

export const hqUserStatuses = ['active', 'inactive'] as const;

export type HqUserStatus = (typeof hqUserStatuses)[number];

export class CreateHqUserDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsEnum(hqUserRoles)
  role!: HqUserRole;

  @IsOptional()
  @IsString()
  branch?: string;
}

export class UpdateHqUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(hqUserRoles)
  role?: HqUserRole;

  @IsOptional()
  @IsString()
  branch?: string;
}

export class UpdateHqUserStatusDto {
  @IsEnum(hqUserStatuses)
  status!: HqUserStatus;
}

export class ResetHqUserPasswordDto {
  @IsEmail()
  email!: string;
}

export class TransferHqUserDto {
  @IsString()
  targetBranch!: string;

  @IsOptional()
  @IsString()
  replacementManagerId?: string;
}
