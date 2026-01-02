import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access a route
 * Use with RolesGuard
 * 
 * @example
 * @Roles('parent')
 * @Roles('parent', 'facility-nurse')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
