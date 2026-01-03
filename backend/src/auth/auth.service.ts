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
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Get user from database
    const user = await this.databaseService.getUserByEmail(email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active (schema uses 'status' column)
    if (user.status !== 'active') {
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
    };

    const accessToken = this.jwtService.sign(payload);

    // Create audit log (non-blocking, don't fail login if audit fails)
    try {
      await this.databaseService.createAuditLog(
        user.id,
        'login',
        'users',
        user.id,
        { after: { login_time: new Date().toISOString() } }
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
      },
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
   */
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.databaseService.getUserById(userId);
    
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid token');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    };

    const accessToken = this.jwtService.sign(payload);

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
   */
  async validateUser(payload: TokenPayload): Promise<UserProfileDto | null> {
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
   * Logout user (optional - for token blacklisting in production)
   */
  async logout(userId: string): Promise<void> {
    // Create audit log for logout
    await this.databaseService.createAuditLog(
      userId,
      'LOGOUT',
      'users',
      userId,
      { after: { logout_time: new Date().toISOString() } }
    );

    // In production with refresh tokens, you would:
    // 1. Invalidate refresh token
    // 2. Add JWT to blacklist (if using redis)
  }
}
