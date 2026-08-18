'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { safeNextPath } from '@/lib/auth/next-path';
import { useSession } from '@/lib/auth/use-session';

/**
 * Holds the sign-in and sign-up forms back until the session is known.
 *
 * Rendering the form first and redirecting afterwards showed anyone already
 * signed in a flash of the login page — most visibly when arriving here from
 * the Back button, where the session resolves from cache a moment later.
 *
 * A signed-in visitor never sees the form; a signed-out one sees a placeholder
 * for as long as one request takes.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isPending } = useSession();

  const next = safeNextPath(searchParams.get('next'));

  useEffect(() => {
    if (user !== null) router.replace(next);
  }, [user, next, router]);

  if (isPending || user !== null) {
    return (
      <div className="w-full max-w-sm space-y-3" aria-hidden>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  return <>{children}</>;
}
