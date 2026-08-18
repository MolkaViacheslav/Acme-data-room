import { withNext } from '@/lib/auth/next-path';

/** The address a share link is browsed at. */
export function shareHref(token: string, folderId?: string): string {
  return folderId === undefined ? `/share/${token}` : `/share/${token}/${folderId}`;
}

/**
 * Where the "Sign in" button on a share page goes.
 *
 * It must carry the share back with it: an invited recipient who signs in has
 * to land on the link they were sent, not in their own drive. That is the whole
 * point of the restricted-share flow, and it is easy to lose by building this
 * string in the component.
 */
export function shareSignInHref(token: string, folderId?: string): string {
  return withNext('/login', shareHref(token, folderId));
}
