import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { TokenPayload } from '../dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key',
    });
  }

  /**
   * Validate JWT payload and return user object
   * This method is called automatically by Passport after verifying the JWT signature
   */
  async validate(payload: TokenPayload) {
    const user = await this.authService.validateUser(payload);
    
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Return user object that will be attached to request.user
    return user;
  }
}
