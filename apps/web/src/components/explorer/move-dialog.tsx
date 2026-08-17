'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { FolderTreeNode } from '@/components/explorer/folder-tree-node';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { describeError, suggestedNameFrom } from '@/lib/api/client';
import { moveFile } from '@/lib/api/files';
import { moveFolder } from '@/lib/api/folders';
import type { BreadcrumbEntry, ChildEntry } from '@/lib/api/types';

interface MoveDialogProps {
  readonly entry: ChildEntry;
  /** Topmost folder the caller may see — the tree starts here. */
  readonly treeRoot: BreadcrumbEntry;
  readonly currentFolderId: string;
  readonly onClose: () => void;
  readonly onMoved: (destinationId: string) => void;
}

export function MoveDialog({
  entry,
  treeRoot,
  currentFolderId,
  onClose,
  onMoved,
}: MoveDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (destinationId: string): Promise<void> => {
      if (entry.type === 'folder') {
        await moveFolder(entry.id, destinationId);
      } else {
        await moveFile(entry.id, destinationId);
      }
    },

    onSuccess: (_result, destinationId) => {
      toast.success(`Moved “${entry.name}”.`);
      onMoved(destinationId);
      onClose();
    },

    onError: (error: unknown) => {
      const suggestion = suggestedNameFrom(error);

      toast.error(
        suggestion === null
          ? describeError(error)
          : `${describeError(error)} A name like “${suggestion}” is free.`,
      );
    },
  });

  const isSameFolder = selectedId === currentFolderId;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move “{entry.name}”</DialogTitle>
          <DialogDescription>Choose a destination folder.</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-md border p-2">
          <ul>
            <FolderTreeNode
              id={treeRoot.id}
              name={treeRoot.name}
              depth={0}
              ancestorIds={[]}
              movingFolderId={entry.type === 'folder' ? entry.id : null}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </ul>
        </div>

        {isSameFolder && (
          <p className="text-muted-foreground text-sm">
            That is where it already is. Pick a different folder.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={selectedId === null || isSameFolder || mutation.isPending}
            onClick={() => selectedId !== null && mutation.mutate(selectedId)}
          >
            {mutation.isPending ? 'Moving…' : 'Move here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
