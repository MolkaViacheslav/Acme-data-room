import { ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';

import type { Actor, AuthenticatedRequest } from './auth.types';

/**
 * The signed-in caller, as put on the request by `JwtAuthGuard`.
 *
 * Throws rather than returning `undefined`, so a controller can never quietly
 * treat an unauthenticated request as anonymous.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user === undefined) {
      throw new UnauthorizedException('You are not signed in.');
    }

    return request.user;
  },
);
