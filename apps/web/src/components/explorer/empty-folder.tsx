import { FolderOpen } from 'lucide-react';

export function EmptyFolder({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <FolderOpen className="text-muted-foreground size-7" aria-hidden />
      <p className="text-sm font-medium">This folder is empty</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {canEdit
          ? 'Create a folder or drop PDFs below to get started.'
          : 'Nothing has been shared into this folder yet.'}
      </p>
    </div>
  );
}
