'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { TableHead } from '@/components/ui/table';
import type { ChildSortField, SortDirection } from '@/lib/api/folders';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  readonly field: ChildSortField;
  readonly label: string;
  readonly activeField: ChildSortField;
  readonly direction: SortDirection;
  readonly onSort: (field: ChildSortField) => void;
  readonly className?: string;
}

export function SortableHeader({
  field,
  label,
  activeField,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = activeField === field;

  return (
    <TableHead className={className} aria-sort={isActive ? ariaSort(direction) : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="text-muted-foreground hover:text-foreground -mx-2 flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors"
      >
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className={cn('size-3.5 opacity-40')} aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

function ariaSort(direction: SortDirection): 'ascending' | 'descending' {
  return direction === 'asc' ? 'ascending' : 'descending';
}
