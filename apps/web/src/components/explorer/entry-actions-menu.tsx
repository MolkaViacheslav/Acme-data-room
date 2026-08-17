'use client';

import { FolderInput, MoreHorizontal, Pencil, SquareArrowOutUpRight, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChildEntry } from '@/lib/api/types';

interface EntryActionsMenuProps {
  readonly entry: ChildEntry;
  readonly onOpen: () => void;
  readonly onRename: () => void;
  readonly onMove: () => void;
  readonly onDelete: () => void;
}

/**
 * Rendered only for an owner — a viewer gets no menu at all, rather than one
 * whose every item would be refused.
 *
 * Sharing joins this menu in the next phase, together with its dialog.
 */
export function EntryActionsMenu({
  entry,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: EntryActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${entry.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onOpen}>
          <SquareArrowOutUpRight className="size-4" />
          Open
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onMove}>
          <FolderInput className="size-4" />
          Move
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
