'use client';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { Breadcrumbs } from '@/components/explorer/breadcrumbs';
import { NewFolderDialog } from '@/components/explorer/new-folder-dialog';
import { ShareButton } from '@/components/share/share-button';
import type { FolderDetail } from '@/lib/api/types';
import type { ExplorerMode } from '@/lib/explorer/explorer-mode';

interface ExplorerHeaderProps {
  readonly folder: FolderDetail;
  readonly mode: ExplorerMode;
  readonly onCreated: () => void;
}

export function ExplorerHeader({ folder, mode, onCreated }: ExplorerHeaderProps) {
  const canEdit = folder.role === 'OWNER';
  const isGuest = mode.token !== undefined;

  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <Breadcrumbs trail={folder.breadcrumb} hrefFor={mode.hrefFor} />
        {/* A guest may not even have an account to sign out of. */}
        {!isGuest && <SignOutButton />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{folder.name}</h1>

        {/* No control appears for something this caller cannot do. */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <ShareButton
              resourceType={folder.isRoot ? 'DATA_ROOM' : 'FOLDER'}
              resourceId={folder.isRoot ? folder.dataRoomId : folder.id}
              name={folder.name}
            />
            <NewFolderDialog parentId={folder.id} onCreated={onCreated} />
          </div>
        )}
      </div>
    </header>
  );
}
