import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';

// ============================================
// Enums
// ============================================

export enum UserRole {
  PARENT = 'parent',
  HQ_ADMIN = 'hq-admin',
  BRANCH_MANAGER = 'branch-manager',
  FACILITY_NURSE = 'facility-nurse',
  CHW = 'chw',
}

// ============================================
// Request DTOs
// ============================================

export class LoginDto {
  @IsEmail()
  @MaxLength(254) // RFC 5321 max email length
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  userType?: UserRole;
}

export class AdminLoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phoneNumber?: string;
}

export class RefreshTokenDto {
  @IsString()
  @MaxLength(500)
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(128)
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(100)
  token: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
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
