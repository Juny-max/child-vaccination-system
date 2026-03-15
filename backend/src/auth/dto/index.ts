import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

// ============================================
// Enums
// ============================================

export enum UserRole {
  PARENT = 'parent',
  HQ_ADMIN = 'hq-admin',
  BRANCH_MANAGER = 'branch-manager',
  FACILITY_NURSE = 'facility-nurse',
  CHW = 'chw',
  DATA_OFFICER = 'data-officer',
  PHA = 'pha',
}

// ============================================
// Request DTOs
// ============================================

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  userType?: UserRole;
}

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

// ============================================
// Response DTOs
// ============================================

export class UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  lastLogin?: string;
  branchId?: string;
}

export class AuthResponseDto {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfileDto;
  mustChangePassword?: boolean;
}

export class PasswordResetResponseDto {
  success: boolean;
  message: string;
}

// ============================================
// Token Types
// ============================================

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: string;
  fullName: string;
  branchId?: string; // facility/branch the user belongs to
  iat?: number; // issued at
  exp?: number; // expiration
}
