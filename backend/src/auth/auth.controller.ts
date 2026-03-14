import { Controller, Post, Get, Body, UseGuards, Request, Response, HttpCode, HttpStatus } from '@nestjs/common';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthResponseDto, UserProfileDto, ChangePasswordDto, AdminLoginDto } from './dto';
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
}
