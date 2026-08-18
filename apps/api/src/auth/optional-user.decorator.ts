import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { Actor, AuthenticatedRequest } from './auth.types';

/**
 * The caller if they happen to be signed in, `null` if not.
 *
 * For `@Public()` routes that behave differently for a known visitor — a share
 * link is readable anonymously with a token, but a restricted share needs to
 * know who is asking.
 *
 * Use `@CurrentUser()` anywhere anonymity is not allowed; it throws instead.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user ?? null;
  },
);
