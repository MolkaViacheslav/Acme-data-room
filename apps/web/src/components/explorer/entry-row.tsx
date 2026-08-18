'use client';

import Link from 'next/link';

import { EntryActionsMenu } from '@/components/explorer/entry-actions-menu';
import { EntryIcon } from '@/components/explorer/entry-icon';
import { InlineRename } from '@/components/explorer/inline-rename';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ChildEntry } from '@/lib/api/types';
import { formatModified, formatSize } from '@/lib/explorer/format';

interface EntryRowProps {
  readonly entry: ChildEntry;
  readonly canEdit: boolean;
  readonly folderHref: (folderId: string) => string;
  readonly isRenaming: boolean;
  readonly onStartRename: () => void;
  readonly onCancelRename: () => void;
  readonly onRename: (name: string) => void;
  readonly onOpen: () => void;
  readonly onMove: () => void;
  readonly onShare: () => void;
  readonly onDelete: () => void;
}

export function EntryRow({
  entry,
  canEdit,
  folderHref,
  isRenaming,
  onStartRename,
  onCancelRename,
  onRename,
  onOpen,
  onMove,
  onShare,
  onDelete,
}: EntryRowProps) {
  return (
    <TableRow>
      <TableCell className="max-w-0">
        <div className="flex items-center gap-2">
          <EntryIcon type={entry.type} />

          {isRenaming ? (
            <InlineRename
              initialName={entry.name}
              onCommit={onRename}
              onCancel={onCancelRename}
            />
          ) : entry.type === 'folder' ? (
            <Link
              href={folderHref(entry.id)}
              className="truncate font-medium hover:underline underline-offset-4"
            >
              {entry.name}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="truncate text-left font-medium hover:underline underline-offset-4"
            >
              {entry.name}
            </button>
          )}
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground w-28 text-center tabular-nums">
        {/* A folder has no size of its own; showing 0 B would be a lie. */}
        {entry.type === 'file' ? formatSize(entry.sizeBytes) : '—'}
      </TableCell>

      <TableCell className="text-muted-foreground hidden w-48 sm:table-cell">
        {formatModified(entry.updatedAt)}
      </TableCell>

      <TableCell className="w-12 text-right">
        {canEdit && (
          <EntryActionsMenu
            entry={entry}
            onOpen={onOpen}
            onRename={onStartRename}
            onMove={onMove}
            onShare={onShare}
            onDelete={onDelete}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
