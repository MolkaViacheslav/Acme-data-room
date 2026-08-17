import type { AppEnv } from '../config/env';

import { accessTokenCookieOptions, clearedAccessTokenCookieOptions } from './cookie';

const baseEnv: AppEnv = {
  nodeEnv: 'development',
  port: 3001,
  corsOrigins: ['http://localhost:3000'],
  databaseUrl: 'postgresql://localhost:6543/postgres',
  jwtSecret: 'x'.repeat(32),
  jwtExpiresInSeconds: 3600,
};

describe('accessTokenCookieOptions', () => {
  it('is cross-site capable in production', () => {
    const options = accessTokenCookieOptions({ ...baseEnv, nodeEnv: 'production' });

    // SameSite=None is what lets vercel.app send the cookie to railway.app,
    // and browsers reject it unless Secure is set alongside.
    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
  });

  it('stays on plain HTTP locally, where both apps are same-site', () => {
    const options = accessTokenCookieOptions(baseEnv);

    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
  });

  it('expires the cookie with the token', () => {
    expect(accessTokenCookieOptions(baseEnv).maxAge).toBe(3600 * 1000);
  });

  it('clears with the same attributes, minus the lifetime', () => {
    const cleared = clearedAccessTokenCookieOptions({ ...baseEnv, nodeEnv: 'production' });

    // A mismatch here silently leaves the old cookie in place.
    expect(cleared.sameSite).toBe('none');
    expect(cleared.secure).toBe(true);
    expect(cleared.path).toBe('/');
    expect(cleared.maxAge).toBeUndefined();
  });
});
