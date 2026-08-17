import type { CookieOptions } from 'express';

import type { AppEnv } from '../config/env';

export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Cookie options live here alone, because this is the one part of auth that
 * differs between local and deployed and is easiest to get subtly wrong.
 *
 * In production the frontend (`*.vercel.app`) and the API (`*.railway.app`)
 * are different sites, so the cookie must be `SameSite=None`, which browsers
 * only accept together with `Secure`.
 *
 * Locally both run on `localhost`, which counts as the same site regardless of
 * port — so `SameSite=Lax` works and `Secure` would break plain HTTP.
 */
export function accessTokenCookieOptions(env: AppEnv): CookieOptions {
  const isCrossSite = env.nodeEnv === 'production';

  return {
    httpOnly: true,
    secure: isCrossSite,
    sameSite: isCrossSite ? 'none' : 'lax',
    path: '/',
    maxAge: env.jwtExpiresInSeconds * 1000,
  };
}

/**
 * Clearing must repeat the same attributes the cookie was set with, or the
 * browser treats it as a different cookie and the old one survives.
 */
export function clearedAccessTokenCookieOptions(env: AppEnv): CookieOptions {
  const { maxAge: _maxAge, ...rest } = accessTokenCookieOptions(env);

  return rest;
}
