'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ErrorState } from '@/components/common/error-state';
import { ExplorerSkeleton } from '@/components/explorer/explorer-skeleton';
import { describeError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/use-session';

export function HomeRedirect() {
  const router = useRouter();
  const { user, error, isPending, isFetching, refetch } = useSession();

  useEffect(() => {
    if (isPending) return;

    if (user === null) {
      router.replace('/login');
      return;
    }
    router.replace(`/d/${user.dataRoom.rootFolderId}`);
  }, [user, isPending, router]);

  // A skeleton, not an error, while the redirect is being worked out.
  if (isPending || error === null) return <ExplorerSkeleton />;

  return (
    <ErrorState
      title="Could not load your account"
      message={describeError(error)}
      onRetry={refetch}
      retrying={isFetching}
    />
  );
}
