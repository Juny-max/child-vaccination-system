import { Controller, Post, Get, Body, UseGuards, Request, Response, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto, UserProfileDto, ChangePasswordDto, AdminLoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: UserProfileDto;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookieOptions(req: ExpressRequest) {
    const hostname = req.hostname || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isSecure = process.env.NODE_ENV === 'production' && !isLocalhost;
    const sameSite: 'none' | 'lax' = isSecure ? 'none' : 'lax';

    return {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  private getClearCookieOptions(req: ExpressRequest) {
    const { maxAge, ...cookieOptions } = this.getCookieOptions(req);
    return cookieOptions;
  }

  /**
   * POST /api/auth/login
   * Login with email, password, and user type
   * Sets JWT in HttpOnly cookie for security
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900 } })  // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse
  ): Promise<ExpressResponse> {
    const authResponse = await this.authService.login(loginDto);
    
    // Set HttpOnly cookie with JWT token
    res.cookie('accessToken', authResponse.accessToken, this.getCookieOptions(req));
    
    // Return user data without exposing token
    return res.json({
      accessToken: authResponse.accessToken,
      tokenType: authResponse.tokenType,
      expiresIn: authResponse.expiresIn,
      user: authResponse.user,
      mustChangePassword: authResponse.mustChangePassword,
    });
  }

  /**
   * POST /api/auth/admin/login
   * HQ admin login endpoint for admin dashboard
   */
  @Post('admin/login')
  @Throttle({ default: { limit: 5, ttl: 900 } })  // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() adminLoginDto: AdminLoginDto,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse
  ): Promise<ExpressResponse> {
    const authResponse = await this.authService.loginAdmin(adminLoginDto);

    res.cookie('accessToken', authResponse.accessToken, this.getCookieOptions(req));

    return res.json({
      accessToken: authResponse.accessToken,
      tokenType: authResponse.tokenType,
      expiresIn: authResponse.expiresIn,
      user: authResponse.user,
      mustChangePassword: authResponse.mustChangePassword,
    });
  }

  /**
   * POST /api/auth/register
   * Register a new parent account
   * Sets JWT in HttpOnly cookie for security
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600 } })  // 3 registrations per hour
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse
  ): Promise<ExpressResponse> {
    const authResponse = await this.authService.registerParent(registerDto);
    
    // Set HttpOnly cookie with JWT token
    res.cookie('accessToken', authResponse.accessToken, this.getCookieOptions(req));
    
    // Return user data without exposing token
    return res.json({
      accessToken: authResponse.accessToken,
      tokenType: authResponse.tokenType,
      expiresIn: authResponse.expiresIn,
      user: authResponse.user,
      mustChangePassword: authResponse.mustChangePassword,
    });
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
   * Logout current user and clear cookie
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: AuthenticatedRequest,
    @Response() res: ExpressResponse
  ): Promise<ExpressResponse> {
    await this.authService.logout(req.user.id);
    
    // Clear the accessToken cookie
    res.clearCookie('accessToken', this.getClearCookieOptions(req));
    
    return res.json({ message: 'Successfully logged out' });
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

  /**
   * POST /api/auth/forgot-password
   * Request password reset with email
   * No authentication required
   * Uses the request Origin header to build the correct reset link (works for both localhost and production)
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Request() req: ExpressRequest,
  ): Promise<{ success: boolean; message: string }> {
    // Use the actual origin of the request so the reset link points to the right deployment
    const baseUrl = (req.headers.origin as string) || process.env.FRONTEND_URL || 'http://localhost:3000';
    try {
      await this.authService.forgotPassword(forgotPasswordDto.email, baseUrl);
    } catch (error) {
      // Don't expose whether email exists or not - return same response
      console.warn('Password reset attempt:', error instanceof Error ? error.message : 'Unknown error');
    }
    // Always return success to prevent email enumeration
    return { success: true, message: 'If an account exists with this email, you will receive password reset instructions shortly.' };
  }

  /**
   * POST /api/auth/reset-password
   * Reset password using reset token
   * No authentication required
   * Token must be valid and not expired (1 hour)
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
    } catch (error) {
      // Log the actual error but return generic message to prevent schema leakage
      console.warn('Password reset error:', error instanceof Error ? error.message : 'Unknown error');
      throw new BadRequestException('Invalid or expired reset token.');
    }
  }
}
