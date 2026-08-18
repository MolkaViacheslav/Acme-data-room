'use client';

import { useQuery } from '@tanstack/react-query';

import { ExplorerSkeleton } from '@/components/explorer/explorer-skeleton';
import { ExplorerView } from '@/components/explorer/explorer-view';
import { SharedFileView } from '@/components/share/shared-file-view';
import { ShareUnavailable, type ShareProblem } from '@/components/share/share-unavailable';
import { refusalReasonFrom } from '@/lib/api/client';
import { resolveShareToken } from '@/lib/api/shares';
import { shareSignInHref } from '@/lib/share/share-href';
import { shareMode } from '@/lib/explorer/explorer-mode';

/**
 * Turns whatever the API said about a share link into one of a small number of
 * states a person can act on.
 *
 * All four of the plan's edge cases land here, so no component further in has
 * to know that it is being viewed through a link.
 */
function problemFrom(error: unknown): ShareProblem {
  const reason = refusalReasonFrom(error);

  if (reason === 'REVOKED') return 'REVOKED';
  if (reason === 'EXPIRED') return 'EXPIRED';
  if (reason === 'SIGN_IN_REQUIRED') return 'SIGN_IN_REQUIRED';
  if (reason === 'NOT_INVITED') return 'NOT_INVITED';

  // A 404 here means the link was never issued, or what it pointed at is gone.
  // Those are indistinguishable on purpose.
  return 'GONE';
}

interface ShareGateProps {
  readonly token: string;
  /** Set when browsing deeper than the folder the link opened on. */
  readonly folderId?: string;
}

export function ShareGate({ token, folderId }: ShareGateProps) {
  const shared = useQuery({
    queryKey: ['share', token],
    queryFn: () => resolveShareToken(token),
    retry: false,
  });

  if (shared.isPending) return <ExplorerSkeleton />;

  if (shared.isError) {
    return (
      <ShareUnavailable
        problem={problemFrom(shared.error)}
        signInHref={shareSignInHref(token, folderId)}
      />
    );
  }

  // A single shared file has no folder to browse. Closing its viewer must not
  // navigate anywhere — least of all to the visitor's own data room.
  if (shared.data.fileId !== null) {
    return (
      <SharedFileView
        fileId={shared.data.fileId}
        fileName={shared.data.name}
        dataRoomName={shared.data.dataRoomName}
        token={token}
      />
    );
  }

  const openFolderId = folderId ?? shared.data.folderId;

  if (openFolderId === null) return <ShareUnavailable problem="GONE" />;

  // The same explorer the owner uses. It renders read-only because the API
  // reports this caller's role as VIEWER, not because of anything set here.
  return <ExplorerView folderId={openFolderId} mode={shareMode(token)} />;
}

