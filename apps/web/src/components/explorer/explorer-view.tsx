'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/common/error-state';
import { DeleteDialog } from '@/components/explorer/delete-dialog';
import { EmptyFolder } from '@/components/explorer/empty-folder';
import { ExplorerHeader } from '@/components/explorer/explorer-header';
import { ExplorerSkeleton } from '@/components/explorer/explorer-skeleton';
import { FolderTable } from '@/components/explorer/folder-table';
import { MoveDialog } from '@/components/explorer/move-dialog';
import { ShareDialog, type ShareTarget } from '@/components/share/share-dialog';
import { UploadPanel } from '@/components/upload/upload-panel';
import { PdfViewerDialog } from '@/components/viewer/pdf-viewer-dialog';
import { Button } from '@/components/ui/button';
import { ApiError, describeError, suggestedNameFrom } from '@/lib/api/client';
import type { ChildSortField, SortDirection } from '@/lib/api/folders';
import type { ChildEntry } from '@/lib/api/types';
import { withNext } from '@/lib/auth/next-path';
import { type ExplorerMode, ownerMode } from '@/lib/explorer/explorer-mode';
import {
  useFolder,
  useFolderChildren,
  useInvalidateFolder,
  useRenameEntry,
} from '@/lib/explorer/queries';

function readSort(value: string | null): ChildSortField {
  return value === 'size' || value === 'updatedAt' ? value : 'name';
}

function readDirection(value: string | null): SortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

interface ExplorerViewProps {
  readonly folderId: string;
  /**
   * Owner drive or shared link. Only addressing differs — read-only behaviour
   * comes from the role the API reports, not from here.
   */
  readonly mode?: ExplorerMode;
}

export function ExplorerView({ folderId, mode = ownerMode }: ExplorerViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sorting lives in the URL so Back behaves and a link carries the view.
  const sort = readSort(searchParams.get('sort'));
  const direction = readDirection(searchParams.get('dir'));

  const folder = useFolder(folderId, mode.token);
  const children = useFolderChildren(folderId, sort, direction, mode.token);
  const invalidate = useInvalidateFolder(folderId);
  const rename = useRenameEntry(folderId);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [moving, setMoving] = useState<ChildEntry | null>(null);
  const [deleting, setDeleting] = useState<ChildEntry | null>(null);
  const [viewing, setViewing] = useState<ChildEntry | null>(null);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);

  function applySort(field: ChildSortField): void {
    const nextDirection = field === sort && direction === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams(searchParams.toString());

    params.set('sort', field);
    params.set('dir', nextDirection);
    // `push`, not `replace`: sorting is a step the Back button should undo.
    router.push(`${mode.hrefFor(folderId)}?${params.toString()}`, { scroll: false });
  }

  function openEntry(entry: ChildEntry): void {
    if (entry.type === 'folder') {
      router.push(mode.hrefFor(entry.id));
      return;
    }
    setViewing(entry);
  }

  function commitRename(entry: ChildEntry, name: string): void {
    setRenamingId(null);

    rename.mutate(
      { entry, name },
      {
        onError: (error: unknown) => {
          const suggestion = suggestedNameFrom(error);

          toast.error(
            suggestion === null
              ? describeError(error)
              : `${describeError(error)} Try “${suggestion}”.`,
          );
        },
      },
    );
  }

  const needsSignIn = folder.error instanceof ApiError && folder.error.status === 401;

  // "You are not signed in" is an instruction, not an error to read. Send them
  // to sign in and bring them back to exactly this page afterwards.
  useEffect(() => {
    if (needsSignIn) router.replace(withNext('/login', pathname));
  }, [needsSignIn, pathname, router]);

  if (folder.isPending || needsSignIn) return <ExplorerSkeleton />;

  if (folder.isError) {
    const missing = folder.error instanceof ApiError && folder.error.status === 404;

    return (
      <ErrorState
        title={missing ? 'This folder is not available' : 'Could not open this folder'}
        message={
          missing
            ? 'It may have been deleted, or you may no longer have access to it.'
            : describeError(folder.error)
        }
        onRetry={missing ? undefined : () => void folder.refetch()}
        retrying={folder.isFetching}
      />
    );
  }

  const canEdit = folder.data.role === 'OWNER';
  const items = children.data?.pages.flatMap((page) => page.items) ?? [];
  const treeRoot = folder.data.breadcrumb[0];

  return (
    <div className="space-y-6">
      <ExplorerHeader folder={folder.data} mode={mode} onCreated={() => invalidate()} />

      <div className="rounded-lg border">
        {children.isPending && <ExplorerSkeleton />}

        {children.isError && (
          <div className="p-4">
            <ErrorState
              title="Could not load this folder's contents"
              message={describeError(children.error)}
              onRetry={() => void children.refetch()}
              retrying={children.isFetching}
            />
          </div>
        )}

        {children.isSuccess && items.length === 0 && <EmptyFolder canEdit={canEdit} />}

        {children.isSuccess && items.length > 0 && (
          <FolderTable
            items={items}
            canEdit={canEdit}
            folderHref={mode.hrefFor}
            sort={sort}
            direction={direction}
            onSort={applySort}
            renamingId={renamingId}
            onStartRename={(entry) => setRenamingId(entry.id)}
            onCancelRename={() => setRenamingId(null)}
            onRename={commitRename}
            onOpen={openEntry}
            onMove={setMoving}
            onShare={(entry) =>
              setSharing({
                resourceType: entry.type === 'folder' ? 'FOLDER' : 'FILE',
                resourceId: entry.id,
                name: entry.name,
              })
            }
            onDelete={setDeleting}
          />
        )}

        {children.hasNextPage && (
          <div className="flex justify-center border-t p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={children.isFetchingNextPage}
              onClick={() => void children.fetchNextPage()}
            >
              {children.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      {canEdit && <UploadPanel folderId={folderId} onUploaded={() => invalidate()} />}

      {moving !== null && treeRoot !== undefined && (
        <MoveDialog
          entry={moving}
          treeRoot={treeRoot}
          currentFolderId={folderId}
          onClose={() => setMoving(null)}
          onMoved={(destinationId) => invalidate(destinationId)}
        />
      )}

      {deleting !== null && (
        <DeleteDialog
          entry={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => invalidate()}
        />
      )}

      {sharing !== null && <ShareDialog target={sharing} onClose={() => setSharing(null)} />}

      {viewing !== null && (
        <PdfViewerDialog
          fileId={viewing.id}
          fileName={viewing.name}
          token={mode.token}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
