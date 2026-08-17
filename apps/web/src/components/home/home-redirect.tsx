'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ErrorState } from '@/components/common/error-state';
import { ExplorerSkeleton } from '@/components/explorer/explorer-skeleton';
import { ApiError, describeError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function HomeRedirect() {
  const router = useRouter();
  const { data, error, isPending, isFetching, refetch } = useSession();

  useEffect(() => {
    if (isUnauthenticated(error)) {
      router.replace('/login');
      return;
    }
    if (data !== undefined) {
      router.replace(`/d/${data.dataRoom.rootFolderId}`);
    }
  }, [data, error, router]);

  // A skeleton, not an error, while the redirect is being worked out.
  if (isPending || isUnauthenticated(error) || data !== undefined) {
    return <ExplorerSkeleton />;
  }

  return (
    <ErrorState
      title="Could not load your account"
      message={describeError(error)}
      onRetry={() => void refetch()}
      retrying={isFetching}
    />
  );
}
