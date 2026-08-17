'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/types';

export const SESSION_QUERY_KEY = ['session'] as const;

/**
 * The signed-in user, or an error if there is none.
 *
 * The session cannot be resolved on the server: the auth cookie belongs to the
 * API's origin, so neither a Server Component nor `middleware.ts` running on
 * Vercel can read it. Only the browser can, and only by asking the API.
 */
export function useSession() {
  return useQuery<AuthUser>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
  });
}
