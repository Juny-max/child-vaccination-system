import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Add custom logic here if needed
    // For example, checking if the route is public
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Throw a proper 401 instead of generic Error(500)
    if (err || !user) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      const message = info?.message || err?.message || 'Unauthorized access';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
