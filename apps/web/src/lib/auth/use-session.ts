'use client';

import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';
import { fetchCurrentUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/types';

export const SESSION_QUERY_KEY = ['session'] as const;

export interface Session {
  /** The signed-in user, or `null` once we know there is not one. */
  readonly user: AuthUser | null;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  /** A problem other than "not signed in" — worth showing and retrying. */
  readonly error: unknown;
  readonly refetch: () => void;
}

/**
 * The signed-in user, or an error if there is none.
 *
 * The session cannot be resolved on the server: the auth cookie belongs to the
 * API's origin, so neither a Server Component nor `middleware.ts` running on
 * Vercel can read it. Only the browser can, and only by asking the API.
 *
 * `user` is deliberately not React Query's raw `data`. A failed refetch leaves
 * the last successful value in place, so `data` can say "signed in" at the same
 * moment the server says 401 — and callers that redirect on one while other
 * callers redirect on the other will ping-pong between pages. Here a 401 wins:
 * it means signed out, whatever is still cached.
 */
export interface SessionQueryState {
  readonly data: AuthUser | undefined;
  readonly error: unknown;
}

/**
 * Decides what the session *is*, given what the query currently holds.
 *
 * Pure and exported so the rule that caused a redirect loop is pinned by a
 * test rather than by reading the component.
 */
export function resolveSession(state: SessionQueryState): {
  user: AuthUser | null;
  error: unknown;
} {
  const unauthorized = state.error instanceof ApiError && state.error.status === 401;

  if (unauthorized) return { user: null, error: null };

  return { user: state.data ?? null, error: state.error };
}

export function useSession(): Session {
  const query = useQuery<AuthUser>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentUser,
  });

  const { user, error } = resolveSession({ data: query.data, error: query.error });

  return {
    user,
    error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}
