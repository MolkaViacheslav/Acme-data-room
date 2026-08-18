import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { AuthenticatedRequest, JwtPayload } from './auth.types';
import { ACCESS_TOKEN_COOKIE } from './cookie';
import { IS_PUBLIC_KEY } from './public.decorator';

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false;

  const { sub, email } = value as { sub?: unknown; email?: unknown };

  return typeof sub === 'string' && sub !== '' && typeof email === 'string';
}

/**
 * Applied globally (see `AuthModule`); routes opt out with `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // A public route still wants to know *who* is calling when it can tell.
    // A share link opened by someone already signed in has to resolve to that
    // person, or a restricted share would treat them as a stranger.
    if (isPublic === true) {
      await this.attachActorIfRecognised(request);
      return true;
    }

    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('You are not signed in.');
    }

    const payload: unknown = await this.jwt.verifyAsync(token).catch(() => {
      // Expired, tampered with, or signed by a previous JWT_SECRET.
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    });

    if (!isJwtPayload(payload)) {
      throw new UnauthorizedException('Your session is not valid. Please sign in again.');
    }

    request.user = { id: payload.sub, email: payload.email };

    return true;
  }

  /**
   * Best-effort identification, used only on public routes.
   *
   * Never throws and never refuses the request: a missing, expired, tampered or
   * oddly-shaped cookie all leave the caller anonymous, which is exactly what a
   * public route expects. `/auth/logout` in particular has to keep working with
   * a cookie that no longer verifies.
   */
  private async attachActorIfRecognised(request: AuthenticatedRequest): Promise<void> {
    try {
      const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

      if (typeof token !== 'string' || token === '') return;

      const payload: unknown = await this.jwt.verifyAsync(token).catch(() => null);

      if (isJwtPayload(payload)) {
        request.user = { id: payload.sub, email: payload.email };
      }
    } catch {
      // Identification is optional here; nothing about it may fail a request.
    }
  }
}
