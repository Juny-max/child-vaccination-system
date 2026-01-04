import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto, UserProfileDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: UserProfileDto;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Login with email, password, and user type
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * POST /api/auth/register
   * Register a new parent account
   * Only parents can self-register
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.registerParent(registerDto);
  }

  /**
   * POST /api/auth/refresh
   * Refresh the JWT token
   * Requires valid JWT in Authorization header
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req: AuthenticatedRequest): Promise<{ accessToken: string }> {
    return this.authService.refreshToken(req.user.id);
  }

  /**
   * GET /api/auth/profile
   * Get current user profile
   * Requires valid JWT in Authorization header
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: AuthenticatedRequest): Promise<UserProfileDto> {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * POST /api/auth/logout
   * Logout current user
   * In production, this would invalidate refresh tokens
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: AuthenticatedRequest): Promise<{ message: string }> {
    await this.authService.logout(req.user.id);
    return { message: 'Successfully logged out' };
  }

  /**
   * GET /api/auth/verify
   * Verify if current token is valid
   */
  @Get('verify')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@Request() req: AuthenticatedRequest): Promise<{ valid: boolean; user: UserProfileDto }> {
    return {
      valid: true,
      user: req.user,
    };
  }

  /**
   * POST /api/auth/change-password
   * Change current user's password
   * Requires valid JWT in Authorization header
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );
  }
}
