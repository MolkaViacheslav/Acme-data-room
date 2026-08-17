'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '@/lib/auth/use-session';

/**
 * Sends an already-signed-in visitor away from `/login` and `/register`.
 *
 * Renders nothing: the forms stay visible and usable while the session check
 * is in flight, so a signed-out visitor never waits on it.
 */
export function RedirectWhenSignedIn() {
  const router = useRouter();
  const { data } = useSession();

  useEffect(() => {
    if (data !== undefined) router.replace('/');
  }, [data, router]);

  return null;
}
