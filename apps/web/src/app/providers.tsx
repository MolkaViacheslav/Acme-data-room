'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api/client';

/** A 401 or a 404 will not fix itself on retry; a flaky network might. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;

  return failureCount < 2;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so each browser tab gets one client that survives
  // re-renders, and no cache is ever shared between users on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
