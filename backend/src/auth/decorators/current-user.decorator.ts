import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserProfileDto } from '../dto';

/**
 * Custom decorator to extract the current user from the request
 * Can optionally extract a specific property from the user object
 * 
 * @example
 * // Get entire user object
 * @CurrentUser() user: UserProfileDto
 * 
 * // Get specific property
 * @CurrentUser('id') userId: string
 * @CurrentUser('role') role: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserProfileDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserProfileDto;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return just that property
    if (data) {
      return user[data];
    }

    // Otherwise return the entire user object
    return user;
  },
);
