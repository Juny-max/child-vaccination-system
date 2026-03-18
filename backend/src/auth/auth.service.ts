import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import LRUCache from 'lru-cache';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../common/database/database.service';
import { EmailService } from '../common/email.service';
import { LoginDto, RegisterDto, AuthResponseDto, TokenPayload, UserProfileDto, UserRole } from './dto';

@Injectable()
export class AuthService {
  private readonly jwtService: JwtService;
  private readonly databaseService: DatabaseService;
  private readonly emailService: EmailService;
  private readonly loginAttempts: LRUCache<string, { count: number; lastAttempt: number }>;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    jwtService: JwtService,
    databaseService: DatabaseService,
    emailService: EmailService,
  ) {
    this.jwtService = jwtService;
    this.databaseService = databaseService;
    this.emailService = emailService;
    this.loginAttempts = new LRUCache<string, { count: number; lastAttempt: number }>({
      max: 10000,
      ttl: this.LOCKOUT_TIME_MS,
    });
  }

  /**
   * Normalize email used as a key for rate limiting
   */
  private normalizeEmailKey(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Check if an email is rate limited
   */
  private isRateLimited(email: string): boolean {
    const key = this.normalizeEmailKey(email);
    const attempt = this.loginAttempts.get(key);
    if (!attempt) return false;

    return attempt.count >= this.MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Record a failed login attempt
   */
  private recordFailedAttempt(email: string): void {
    const key = this.normalizeEmailKey(email);
    const now = Date.now();

    const existing = this.loginAttempts.get(key);
    const attempt = existing
      ? { ...existing }
      : { count: 0, lastAttempt: now };

    attempt.count += 1;
    attempt.lastAttempt = now;
    this.loginAttempts.set(key, attempt);
  }

  /**
   * Clear login attempts after successful login
   */
  private clearLoginAttempts(email: string): void {
    const key = this.normalizeEmailKey(email);
    this.loginAttempts.delete(key);
  }

  /**
   * Validate user credentials and generate JWT token
   * Enhanced with security audit logging
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password, userType } = loginDto;

    // Rate limiting check
    if (this.isRateLimited(email)) {
      throw new UnauthorizedException('Too many login attempts. Please try again later.');
    }

    // Get user from database
    const user = await this.databaseService.getUserByEmail(email);
    
    if (!user) {
      // Log failed login attempt - invalid email
      try {
        await this.databaseService.createAuditLog(
          'system',
          'access',
          'users',
          'unknown',
          { 
            after: { 
              event: 'failed_login',
              reason: 'invalid_email',
              email,
              timestamp: new Date().toISOString()
            } 
          }
        );
      } catch (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
      }
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      // Log failed login attempt - invalid password
      try {
        await this.databaseService.createAuditLog(
          user.id,
          'access',
          'users',
          user.id,
          { 
            after: { 
              event: 'failed_login',
              reason: 'invalid_password',
              email,
              timestamp: new Date().toISOString()
            } 
          }
        );
      } catch (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
      }
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    const normalizedRole = this.normalizeRole(user.role);
    if (!normalizedRole) {
      throw new UnauthorizedException('Invalid account role configuration');
    }

    // If a non-parent userType is requested, enforce role match.
    // We intentionally keep parent/default login permissive for the unified login UX.
    if (userType && userType !== UserRole.PARENT && userType !== normalizedRole) {
      throw new UnauthorizedException('Access denied for the selected account type');
    }

    // Check if user is active across both legacy and current schemas
    if (!this.isUserActive(user)) {
      // Log attempt to access deactivated account
      try {
        await this.databaseService.createAuditLog(
          user.id,
          'access',
          'users',
          user.id,
          { 
            after: { 
              event: 'failed_login',
              reason: 'account_deactivated',
              timestamp: new Date().toISOString()
            } 
          }
        );
      } catch (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
      }
      throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
    }

    // Update last login timestamp
    await this.databaseService.updateLastLogin(user.id);

    // Generate JWT token
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: normalizedRole,
      fullName: user.full_name,
      branchId: user.branch_id || undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create successful login audit log
    try {
      await this.databaseService.createAuditLog(
        user.id,
        'login',
        'users',
        user.id,
        { 
          after: { 
            event: 'successful_login',
            login_time: new Date().toISOString(),
            role: normalizedRole
          } 
        }
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    // Clear login attempts after successful login
    this.clearLoginAttempts(email);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 604800, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: normalizedRole,
        phoneNumber: user.phone_number,
        lastLogin: user.last_login,
        branchId: user.branch_id || undefined,
      },
      mustChangePassword: user.must_change_password || false,
    };
  }

  /**
   * Admin-only login path for HQ dashboard access
   */
  async loginAdmin(credentials: { email: string; password: string }): Promise<AuthResponseDto> {
    const authResponse = await this.login({
      email: credentials.email,
      password: credentials.password,
      userType: UserRole.HQ_ADMIN,
    });

    if (authResponse.user.role !== UserRole.HQ_ADMIN) {
      throw new UnauthorizedException('Only HQ admins can access this endpoint');
    }

    return authResponse;
  }

  /**
   * Register a new parent user
   * Only parents can self-register, other users are created by admins
   */
  async registerParent(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, fullName, phoneNumber } = registerDto;

    // Check if email already exists
    const existingUser = await this.databaseService.getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('An account with this email already exists');
    }

    // Hash the password (in production use bcrypt)
    const passwordHash = await this.hashPassword(password);

    // Create user in database
    const { data: newUser, error } = await this.databaseService.supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        phone_number: phoneNumber,
        role: 'parent',
        is_active: true,
      })
      .select()
      .single();

    if (error || !newUser) {
      throw new BadRequestException('Failed to create account. Please try again.');
    }

    // Create guardian record for the parent
    const { error: guardianError } = await this.databaseService.supabase
      .from('guardians')
      .insert({
        user_id: newUser.id,
        full_name: fullName,
        phone_number: phoneNumber,
        email: email,
        relationship_type: 'mother',
        is_primary: true,
      });

    if (guardianError) {
      // Rollback user creation if guardian creation fails
      await this.databaseService.supabase
        .from('users')
        .delete()
        .eq('id', newUser.id);
      
      throw new BadRequestException('Failed to complete registration. Please try again.');
    }

    // Generate JWT token
    const payload: TokenPayload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      fullName: newUser.full_name,
    };

    const accessToken = this.jwtService.sign(payload);

    // Create audit log
    await this.databaseService.createAuditLog(
      newUser.id,
      'REGISTER',
      'users',
      newUser.id,
      { after: { registered_at: new Date().toISOString() } }
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 604800,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        phoneNumber: newUser.phone_number,
        lastLogin: undefined,
      },
    };
  }

  /**
   * Refresh JWT token
   * Enhanced with audit logging
   */
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.databaseService.getUserById(userId);
    
    if (!user || !this.isUserActive(user)) {
      // Log suspicious token refresh attempt
      try {
        await this.databaseService.createAuditLog(
          userId,
          'access',
          'users',
          userId,
          { 
            after: { 
              event: 'failed_token_refresh',
              reason: 'invalid_user_or_inactive',
              timestamp: new Date().toISOString()
            } 
          }
        );
      } catch (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
      }
      throw new UnauthorizedException('Invalid token');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    };

    const accessToken = this.jwtService.sign(payload);

    // Log successful token refresh
    try {
      await this.databaseService.createAuditLog(
        userId,
        'access',
        'users',
        userId,
        { 
          after: { 
            event: 'token_refreshed',
            timestamp: new Date().toISOString()
          } 
        }
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    return { accessToken };
  }

  /**
   * Get user profile from token
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.databaseService.getUserById(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      phoneNumber: user.phone_number,
      lastLogin: user.last_login,
    };
  }

  /**
   * Validate JWT token payload
   * Gracefully handles Supabase connectivity issues
   */
  async validateUser(payload: TokenPayload): Promise<UserProfileDto | null> {
    try {
      const user = await this.databaseService.getUserById(payload.sub);

      if (!user) {
        return null;
      }

      // Legacy seed data uses `status`, newer records also have `is_active`
      const statusFlag = typeof user.status === 'string' ? user.status === 'active' : true;
      const booleanFlag = typeof user.is_active === 'boolean' ? user.is_active : true;

      if (!statusFlag || !booleanFlag) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phoneNumber: user.phone_number,
        lastLogin: user.last_login,
        branchId: user.branch_id || undefined,
      };
    } catch (error: any) {
      // For network/Supabase errors, return null to trigger 401
      // The frontend will then know auth failed and can handle offline mode
      if (error.message?.includes('fetch failed') || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT') {
        // Downgraded to debug level - these are handled gracefully
        // Uncomment to see these warnings: console.warn('[Auth] Temporary database unreachable during JWT validation');
        return null;
      }
      
      // Only log real errors (not network hiccups)
      console.error(`[Auth] Failed to validate user ${payload.sub}:`, error.message);
      
      // Re-throw other errors
      throw error;
    }
  }

  private normalizeRole(role: string | null | undefined): UserRole | null {
    if (!role) return null;

    const normalized = role.toLowerCase().replace(/_/g, '-').trim();
    const validRoles = Object.values(UserRole);
    return validRoles.includes(normalized as UserRole) ? (normalized as UserRole) : null;
  }

  private isUserActive(user: { status?: string | null; is_active?: boolean | null }): boolean {
    const statusFlag = typeof user.status === 'string' ? user.status === 'active' : true;
    const booleanFlag = typeof user.is_active === 'boolean' ? user.is_active : true;
    return statusFlag && booleanFlag;
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify password against stored hash
   * Supports both bcrypt (new) and SHA-256 (legacy seed data)
   */
  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Try bcrypt first (for new user passwords)
    try {
      const isBcryptValid = await bcrypt.compare(password, storedHash);
      if (isBcryptValid) return true;
    } catch (error) {
      // Not a bcrypt hash, continue to SHA-256
    }

    // Fall back to SHA-256 for legacy passwords (seed data)
    const sha256Hash = createHash('sha256').update(password).digest('hex');
    return sha256Hash === storedHash;
  }

  /**
   * Generate secure reset token (32 characters)
   */
  private generateResetToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Request password reset with email
   * Returns success message without revealing if email exists (security best practice)
   */
  async forgotPassword(email: string, baseUrl?: string): Promise<{ success: boolean; message: string; emailFound: boolean }> {
    const GENERIC_MSG = 'If an account exists with this email, you will receive a password reset link.';

    // Look up user — don't reveal whether email exists in the message, but track internally
    const user = await this.databaseService.getUserByEmail(email);
    if (!user) {
      console.log(`[FORGOT-PASSWORD] No account found for: ${email}`);
      return { success: true, message: GENERIC_MSG, emailFound: false };
    }

    console.log(`[FORGOT-PASSWORD] Found user: ${user.email} (id: ${user.id})`);

    // Generate token with 1-hour expiration
    const resetToken = this.generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Save token — if this fails the table probably doesn't exist yet
    const { error: insertError } = await this.databaseService.supabase
      .from('password_reset_tokens')
      .insert({ user_id: user.id, token: resetToken, expires_at: expiresAt.toISOString() });

    if (insertError) {
      console.error('[FORGOT-PASSWORD] ❌ Failed to save reset token (table missing? run the migration!):', insertError.message);
      throw new BadRequestException('Password reset is not available right now. Please contact your administrator.');
    }

    console.log(`[FORGOT-PASSWORD] Token saved. Expires at: ${expiresAt.toISOString()}`);

    // Build reset link using the request's actual origin (auto-detects localhost vs production)
    const frontendUrl = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    console.log(`[FORGOT-PASSWORD] Reset link: ${resetLink}`);

    const emailSent = await this.emailService.sendPasswordResetEmail(
      { email: user.email, name: user.full_name },
      resetLink,
    );

    if (emailSent) {
      console.log(`[FORGOT-PASSWORD] ✅ Email sent to ${user.email}`);
    } else {
      console.error(`[FORGOT-PASSWORD] ❌ Email FAILED for ${user.email}. Check SMTP_FROM is a verified Brevo sender.`);
    }

    try {
      await this.databaseService.createAuditLog(user.id, 'update', 'users', user.id, {
        after: { event: 'password_reset_requested', timestamp: new Date().toISOString() },
      });
    } catch (auditError) {
      console.warn('[FORGOT-PASSWORD] Audit log failed (non-critical):', auditError);
    }

    return { success: true, message: GENERIC_MSG, emailFound: true };
  }

  /**
   * Reset password using token
   * Token must be valid and not expired
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Validate token format
    if (!token || typeof token !== 'string' || token.length !== 48) {
      throw new BadRequestException('Invalid or malformed reset token');
    }

    // Get reset token from database
    const { data: resetTokenData, error: tokenError } = await this.databaseService.supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !resetTokenData) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetTokenData.expires_at);

    if (now > expiresAt) {
      // Delete expired token
      await this.databaseService.supabase
        .from('password_reset_tokens')
        .delete()
        .eq('id', resetTokenData.id);

      throw new UnauthorizedException('Password reset token has expired. Please request a new one.');
    }

    // Get user
    const user = await this.databaseService.getUserById(resetTokenData.user_id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Update password in database
    const { error: updateError } = await this.databaseService.supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error resetting password:', updateError);
      throw new BadRequestException('Failed to update password');
    }

    // Delete the used reset token
    const { error: deleteError } = await this.databaseService.supabase
      .from('password_reset_tokens')
      .delete()
      .eq('id', resetTokenData.id);

    if (deleteError) {
      console.warn('Failed to delete reset token after successful reset:', deleteError);
    }

    // Create audit log
    try {
      await this.databaseService.createAuditLog(
        user.id,
        'update',
        'users',
        user.id,
        {
          after: {
            event: 'password_reset_completed',
            password_reset_time: new Date().toISOString(),
          },
        },
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  }

  /**
   * Logout user
   * Enhanced with security audit logging
   */
  async logout(userId: string): Promise<void> {
    // Create comprehensive audit log for logout
    try {
      await this.databaseService.createAuditLog(
        userId,
        'update',
        'users',
        userId,
        { 
          after: { 
            event: 'user_logout',
            logout_time: new Date().toISOString()
          } 
        }
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    // In production with refresh tokens, you would:
    // 1. Invalidate refresh token
    // 2. Add JWT to blacklist (if using redis)
    // 3. Clear session data from database
  }

  /**
   * Change user password
   * Enhanced with security audit logging
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Get user from database
    const user = await this.databaseService.getUserById(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await this.verifyPassword(currentPassword, user.password_hash);
    
    if (!isPasswordValid) {
      // Log failed password change attempt
      try {
        await this.databaseService.createAuditLog(
          userId,
          'access',
          'users',
          userId,
          { 
            after: { 
              event: 'failed_password_change',
              reason: 'incorrect_current_password',
              timestamp: new Date().toISOString()
            } 
          }
        );
      } catch (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
      }
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Update password in database and clear must_change_password flag
    const { error } = await this.databaseService.supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating password:', error);
      throw new BadRequestException('Failed to update password');
    }

    // Create comprehensive audit log for successful password change
    try {
      await this.databaseService.createAuditLog(
        userId,
        'update',
        'users',
        userId,
        { 
          after: { 
            event: 'password_changed',
            password_changed: new Date().toISOString(),
            must_change_password_cleared: true
          } 
        }
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}
