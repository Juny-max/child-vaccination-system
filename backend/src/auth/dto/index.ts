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

  @IsEnum(UserRole)
  userType: UserRole;
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
}

export class AuthResponseDto {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfileDto;
}

// ============================================
// Token Types
// ============================================

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: string;
  fullName: string;
  iat?: number; // issued at
  exp?: number; // expiration
}
