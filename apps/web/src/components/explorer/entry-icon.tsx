import { FileText, Folder } from 'lucide-react';

import type { ChildEntry } from '@/lib/api/types';

export function EntryIcon({ type }: { type: ChildEntry['type'] }) {
  return type === 'folder' ? (
    <Folder className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
  ) : (
    <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
  );
}
