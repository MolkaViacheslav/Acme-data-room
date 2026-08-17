'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { DataRoomSummary } from '@/components/home/data-room-summary';
import { HomeSkeleton } from '@/components/home/home-skeleton';
import { SessionError } from '@/components/home/session-error';
import { ApiError, describeError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function SignedInHome() {
  const router = useRouter();
  const { data, error, isPending, isFetching, refetch } = useSession();

  useEffect(() => {
    if (isUnauthenticated(error)) router.replace('/login');
  }, [error, router]);

  // Keep the skeleton up while the redirect happens, rather than flashing an
  // error the visitor cannot act on.
  if (isPending || isUnauthenticated(error)) return <HomeSkeleton />;

  if (error !== null) {
    return (
      <SessionError
        message={describeError(error)}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  return <DataRoomSummary user={data} />;
}
