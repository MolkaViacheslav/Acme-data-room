'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/api/client';
import { deleteFile } from '@/lib/api/files';
import { deleteFolder, fetchDeletePreview } from '@/lib/api/folders';
import type { ChildEntry, DeletePreview } from '@/lib/api/types';
import { formatSize } from '@/lib/explorer/format';
import { folderKeys } from '@/lib/explorer/queries';

interface DeleteDialogProps {
  readonly entry: ChildEntry;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

/** Says exactly what will be lost, using counts from the server. */
function describeConsequences(preview: DeletePreview): string {
  const parts: string[] = [];

  if (preview.folderCount > 0) {
    parts.push(`${preview.folderCount} ${preview.folderCount === 1 ? 'folder' : 'folders'}`);
  }
  if (preview.fileCount > 0) {
    parts.push(`${preview.fileCount} ${preview.fileCount === 1 ? 'file' : 'files'}`);
  }

  if (parts.length === 0) return 'This folder is empty.';

  const size = preview.totalBytes > 0 ? ` (${formatSize(preview.totalBytes)})` : '';

  return `This will permanently delete ${parts.join(' and ')}${size} inside it.`;
}

export function DeleteDialog({ entry, onClose, onDeleted }: DeleteDialogProps) {
  const isFolder = entry.type === 'folder';

  // Only a folder has a subtree worth warning about.
  const preview = useQuery({
    queryKey: folderKeys.deletePreview(entry.id),
    queryFn: () => fetchDeletePreview(entry.id),
    enabled: isFolder,
  });

  const mutation = useMutation({
    mutationFn: () => (isFolder ? deleteFolder(entry.id) : deleteFile(entry.id)),
    onSuccess: () => {
      toast.success(`Deleted “${entry.name}”.`);
      onDeleted();
      onClose();
    },
    onError: (error: unknown) => toast.error(describeError(error)),
  });

  const waitingOnCounts = isFolder && preview.isPending;

  return (
    <AlertDialog open onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{entry.name}”?</AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {!isFolder && <p>This file will be permanently deleted.</p>}

              {isFolder && preview.isPending && <Skeleton className="h-4 w-64" />}

              {isFolder && preview.isError && (
                <p className="text-destructive">
                  Could not count what is inside. Deleting is still permanent.
                </p>
              )}

              {isFolder && preview.isSuccess && <p>{describeConsequences(preview.data)}</p>}

              <p className="text-muted-foreground">This cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={waitingOnCounts || mutation.isPending}
            onClick={(event) => {
              // Keep the dialog up while the request is in flight.
              event.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
