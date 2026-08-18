'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { SESSION_QUERY_KEY } from '@/lib/auth/use-session';

/** A 401 or a 404 will not fix itself on retry; a flaky network might. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;

  return failureCount < 2;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so each browser tab gets one client that survives
  // re-renders, and no cache is ever shared between users on the server.
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      /**
       * A 401 anywhere means the session is gone, so the cached session is
       * dropped rather than left behind.
       *
       * React Query keeps the last successful data when a refetch fails, so
       * without this `useSession()` reports a signed-in user *and* a 401 at the
       * same time. Anything redirecting on "there is a user" then bounces
       * against anything redirecting on "not authorised", which is a navigation
       * loop that re-requests both endpoints roughly once a second.
       */
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (!isUnauthorized(error)) return;
          if (query.queryHash === JSON.stringify(SESSION_QUERY_KEY)) return;

          client.removeQueries({ queryKey: SESSION_QUERY_KEY });
        },
      }),
      defaultOptions: {
        queries: {
          retry: shouldRetry,
          refetchOnWindowFocus: false,
          // Without this every mount refetches, so reopening a dialog or
          // stepping back into a folder waits on a round trip that already
          // happened. Every mutation invalidates what it touched, so the
          // only staleness this can show is another session's change.
          staleTime: 15_000,
        },
        mutations: { retry: false },
      },
    });

    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
