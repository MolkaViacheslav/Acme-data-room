'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';

import { ShareDialog } from '@/components/share/share-dialog';
import { Button } from '@/components/ui/button';
import type { ShareResourceType } from '@/lib/api/types';

interface ShareButtonProps {
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  readonly name: string;
}

/** Shares whatever the header is currently showing. */
export function ShareButton({ resourceType, resourceId, name }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="size-4" />
        Share
      </Button>

      {open && (
        <ShareDialog
          target={{ resourceType, resourceId, name }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
