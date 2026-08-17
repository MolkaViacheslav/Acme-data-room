import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the globally applied `JwtAuthGuard`.
 *
 * Authentication is on by default and switched off deliberately, so a new
 * endpoint cannot be left unprotected by forgetting a decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
