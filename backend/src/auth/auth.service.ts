import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../common/database/database.service';
import { LoginDto, RegisterDto, AuthResponseDto, TokenPayload, UserProfileDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Validate user credentials and generate JWT token
   * Enhanced with security audit logging
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

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
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active (schema uses 'status' column)
    if (user.status !== 'active') {
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
      role: user.role,
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
            role: user.role
          } 
        }
      );
    } catch (auditError) {
      console.warn('Audit log failed (non-critical):', auditError);
    }

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 604800, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phoneNumber: user.phone_number,
        lastLogin: user.last_login,
        branchId: user.branch_id || undefined,
      },
      mustChangePassword: user.must_change_password || false,
    };
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
    
    if (!user || !user.is_active) {
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

  /**
   * Hash password using bcrypt-like algorithm
   * In production, use proper bcrypt with salt rounds
   */
  private async hashPassword(password: string): Promise<string> {
    // For demo purposes, we'll use a simple hash
    // In production, use: return bcrypt.hash(password, 10);
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify password against stored hash
   */
  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // For demo purposes, hash the input and compare
    // In production, use: return bcrypt.compare(password, storedHash);
    const hashedInput = await this.hashPassword(password);
    return hashedInput === storedHash;
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
