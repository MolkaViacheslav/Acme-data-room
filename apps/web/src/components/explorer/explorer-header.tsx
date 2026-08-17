'use client';

import { Breadcrumbs } from '@/components/explorer/breadcrumbs';
import { NewFolderDialog } from '@/components/explorer/new-folder-dialog';
import { SignOutButton } from '@/components/auth/sign-out-button';
import type { FolderDetail } from '@/lib/api/types';

interface ExplorerHeaderProps {
  readonly folder: FolderDetail;
  readonly onCreated: () => void;
}

export function ExplorerHeader({ folder, onCreated }: ExplorerHeaderProps) {
  const canEdit = folder.role === 'OWNER';

  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <Breadcrumbs trail={folder.breadcrumb} />
        <SignOutButton />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{folder.name}</h1>

        {/* No control appears for something this caller cannot do. */}
        {canEdit && <NewFolderDialog parentId={folder.id} onCreated={onCreated} />}
      </div>
    </header>
  );
}
