'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Folder, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { fetchFolderChildren } from '@/lib/api/folders';
import { cn } from '@/lib/utils';

export interface FolderTreeNodeProps {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  /** Ids of every folder above this one, used to detect the blocked subtree. */
  readonly ancestorIds: readonly string[];
  /** The folder being moved, when a folder is being moved. */
  readonly movingFolderId: string | null;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

export function FolderTreeNode({
  id,
  name,
  depth,
  ancestorIds,
  movingFolderId,
  selectedId,
  onSelect,
}: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);

  const children = useQuery({
    queryKey: ['folder', id, 'tree-children'],
    queryFn: () => fetchFolderChildren(id, { sort: 'name', direction: 'asc', limit: 200 }),
    enabled: expanded,
    // Reopening the move dialog, or collapsing and expanding a branch, should
    // not pay for the same request again.
    staleTime: 60_000,
  });

  // A folder cannot be moved into itself or anywhere beneath itself. The tree
  // is built top-down, so each node already knows its ancestors — no extra
  // request is needed to work this out. The API enforces the same rule.
  const isBlocked =
    movingFolderId !== null && (id === movingFolderId || ancestorIds.includes(movingFolderId));

  const subfolders = (children.data?.items ?? []).filter((item) => item.type === 'folder');

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md',
          selectedId === id && 'bg-accent',
        )}
        style={{ paddingLeft: `${depth * 1}rem` }}
      >
        <button
          type="button"
          aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          onClick={() => setExpanded((current) => !current)}
          className="text-muted-foreground hover:text-foreground rounded p-1"
        >
          {expanded ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
        </button>

        <button
          type="button"
          disabled={isBlocked}
          onClick={() => onSelect(id)}
          title={isBlocked ? 'A folder cannot be moved into itself.' : undefined}
          className={cn(
            'flex flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm',
            isBlocked ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent',
          )}
        >
          <Folder className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <span className="truncate">{name}</span>
        </button>
      </div>

      {expanded && (
        <>
          {children.isPending && (
            <p className="text-muted-foreground flex items-center gap-2 py-1 text-xs"
               style={{ paddingLeft: `${(depth + 1) * 1 + 1.5}rem` }}>
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Loading…
            </p>
          )}

          {children.isError && (
            <p className="text-destructive py-1 text-xs"
               style={{ paddingLeft: `${(depth + 1) * 1 + 1.5}rem` }}>
              Could not load subfolders.
            </p>
          )}

          {children.isSuccess && subfolders.length === 0 && (
            <p className="text-muted-foreground py-1 text-xs"
               style={{ paddingLeft: `${(depth + 1) * 1 + 1.5}rem` }}>
              No subfolders
            </p>
          )}

          <ul>
            {subfolders.map((child) => (
              <FolderTreeNode
                key={child.id}
                id={child.id}
                name={child.name}
                depth={depth + 1}
                ancestorIds={[...ancestorIds, id]}
                movingFolderId={movingFolderId}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
