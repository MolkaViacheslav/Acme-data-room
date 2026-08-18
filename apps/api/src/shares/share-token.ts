import { randomBytes } from 'node:crypto';

/**
 * 32 bytes of randomness, base64url so it survives a URL untouched.
 *
 * Every share gets one, in both modes, because the token is the share's
 * address — `/share/<token>` is how anyone reaches it. What it *means* differs:
 * for a public link the token is the credential, while for a restricted share
 * it only says which share is being opened and authorisation still comes from
 * being a named recipient. `decideAccess` reflects that: it never consults the
 * token for a restricted share.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}
