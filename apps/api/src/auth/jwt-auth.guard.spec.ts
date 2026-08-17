import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedRequest } from './auth.types';
import { ACCESS_TOKEN_COOKIE } from './cookie';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithCookies(cookies: Record<string, string>): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = { cookies } as unknown as AuthenticatedRequest;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  return { context, request };
}

function createGuard(options: {
  isPublic?: boolean;
  verify?: () => Promise<unknown>;
}): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: () => options.isPublic,
  } as unknown as Reflector;

  const jwt = {
    verifyAsync: options.verify ?? (() => Promise.reject(new Error('invalid'))),
  } as unknown as JwtService;

  return new JwtAuthGuard(jwt, reflector);
}

describe('JwtAuthGuard', () => {
  it('lets a @Public() route through without a cookie', async () => {
    const guard = createGuard({ isPublic: true });
    const { context } = contextWithCookies({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request with no access token', async () => {
    const guard = createGuard({});
    const { context } = contextWithCookies({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails verification', async () => {
    const guard = createGuard({ verify: () => Promise.reject(new Error('expired')) });
    const { context } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: 'tampered' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a well-signed token whose claims are the wrong shape', async () => {
    const guard = createGuard({ verify: () => Promise.resolve({ sub: 42 }) });
    const { context } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: 'odd' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('puts the actor on the request for a valid token', async () => {
    const guard = createGuard({
      verify: () => Promise.resolve({ sub: 'user-1', email: 'ada@example.com' }),
    });
    const { context, request } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: 'good' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'ada@example.com' });
  });
});
