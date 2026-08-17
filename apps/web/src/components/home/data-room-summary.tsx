import { FolderLock } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { UploadPanel } from '@/components/upload/upload-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuthUser } from '@/lib/api/types';

export function DataRoomSummary({ user }: { user: AuthUser }) {
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Signed in as {user.name}</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderLock className="text-muted-foreground size-5 shrink-0" />
            <div className="grid gap-1">
              <CardTitle>{user.dataRoom.name}</CardTitle>
              <CardDescription>Your private data room.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-muted-foreground text-sm">
            Browsing and sharing arrive in the next steps. Uploads below go into the top-level
            folder of this data room.
          </p>
        </CardContent>
      </Card>

      <UploadPanel folderId={user.dataRoom.rootFolderId} />
    </div>
  );
}
