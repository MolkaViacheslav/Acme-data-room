'use client';

import { EntryRow } from '@/components/explorer/entry-row';
import { SortableHeader } from '@/components/explorer/sortable-header';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChildSortField, SortDirection } from '@/lib/api/folders';
import type { ChildEntry } from '@/lib/api/types';

interface FolderTableProps {
  readonly items: readonly ChildEntry[];
  readonly canEdit: boolean;
  readonly sort: ChildSortField;
  readonly direction: SortDirection;
  readonly onSort: (field: ChildSortField) => void;
  readonly renamingId: string | null;
  readonly onStartRename: (entry: ChildEntry) => void;
  readonly onCancelRename: () => void;
  readonly onRename: (entry: ChildEntry, name: string) => void;
  readonly onOpen: (entry: ChildEntry) => void;
  readonly onMove: (entry: ChildEntry) => void;
  readonly onDelete: (entry: ChildEntry) => void;
}

export function FolderTable({
  items,
  canEdit,
  sort,
  direction,
  onSort,
  renamingId,
  onStartRename,
  onCancelRename,
  onRename,
  onOpen,
  onMove,
  onDelete,
}: FolderTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            field="name"
            label="Name"
            activeField={sort}
            direction={direction}
            onSort={onSort}
          />
          <SortableHeader
            field="size"
            label="Size"
            activeField={sort}
            direction={direction}
            onSort={onSort}
            className="w-28 text-right"
          />
          <SortableHeader
            field="updatedAt"
            label="Modified"
            activeField={sort}
            direction={direction}
            onSort={onSort}
            className="hidden w-48 sm:table-cell"
          />
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {items.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            canEdit={canEdit}
            isRenaming={renamingId === entry.id}
            onStartRename={() => onStartRename(entry)}
            onCancelRename={onCancelRename}
            onRename={(name) => onRename(entry, name)}
            onOpen={() => onOpen(entry)}
            onMove={() => onMove(entry)}
            onDelete={() => onDelete(entry)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
