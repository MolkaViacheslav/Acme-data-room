/**
 * Where to send someone once they have signed in.
 *
 * Defined once because it was previously worked out separately in the sign-in
 * form and the auth gate, and the sign-up form did not do it at all — so a
 * visitor who followed a share link and chose to create an account lost the
 * link and landed in their own drive instead.
 */
const FALLBACK = '/';

/**
 * Accepts same-site paths only.
 *
 * `//evil.example` and `https://evil.example` are both rejected: a redirect
 * target taken from the query string is an open redirect unless it is
 * constrained to this origin.
 */
export function safeNextPath(raw: string | null): string {
  if (raw === null || raw === '') return FALLBACK;
  if (!raw.startsWith('/')) return FALLBACK;
  if (raw.startsWith('//')) return FALLBACK;
  // A backslash is treated as a slash by some browsers when resolving URLs.
  if (raw.startsWith('/\\')) return FALLBACK;

  return raw;
}

/** Adds `?next=` to an auth route, carrying the destination through. */
export function withNext(path: string, next: string | null): string {
  const destination = safeNextPath(next);

  if (destination === FALLBACK) return path;

  return `${path}?next=${encodeURIComponent(destination)}`;
}
