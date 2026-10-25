import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare required roles for accessing an endpoint or controller.
 * e.g., @Roles('admin', 'auditor')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
