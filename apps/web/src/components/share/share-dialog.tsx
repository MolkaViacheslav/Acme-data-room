'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { ShareList } from '@/components/share/share-list';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/api/client';
import { createShare, fetchShares } from '@/lib/api/shares';
import type { ShareMode, ShareResourceType } from '@/lib/api/types';

export interface ShareTarget {
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  readonly name: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ShareMode>('PUBLIC_LINK');
  const [emailDraft, setEmailDraft] = useState('');
  const [emails, setEmails] = useState<readonly string[]>([]);

  const sharesKey = ['shares', target.resourceType, target.resourceId] as const;

  const shares = useQuery({
    queryKey: sharesKey,
    queryFn: () => fetchShares(target.resourceType, target.resourceId),
  });

  const create = useMutation({
    mutationFn: () =>
      createShare({
        resourceType: target.resourceType,
        resourceId: target.resourceId,
        mode,
        recipientEmails: mode === 'RESTRICTED' ? emails : undefined,
      }),
    onSuccess: () => {
      toast.success('Link created.');
      setEmails([]);
      setEmailDraft('');
      void queryClient.invalidateQueries({ queryKey: sharesKey });
    },
    onError: (error: unknown) => toast.error(describeError(error)),
  });

  function addEmail(): void {
    const candidate = emailDraft.trim().toLowerCase();

    if (candidate === '') return;
    if (!EMAIL_PATTERN.test(candidate)) {
      toast.error('That does not look like an email address.');
      return;
    }
    if (!emails.includes(candidate)) setEmails((current) => [...current, candidate]);
    setEmailDraft('');
  }

  const canCreate = mode === 'PUBLIC_LINK' || emails.length > 0;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">
            {target.resourceType === 'DATA_ROOM' ? 'Share this data room' : `Share “${target.name}”`}
          </DialogTitle>
          <DialogDescription>Anyone you share with gets read-only access.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(['PUBLIC_LINK', 'RESTRICTED'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={mode === option ? 'default' : 'outline'}
                onClick={() => setMode(option)}
              >
                {option === 'PUBLIC_LINK' ? 'Anyone with the link' : 'Specific people'}
              </Button>
            ))}
          </div>

          {mode === 'RESTRICTED' && (
            <div className="grid gap-2">
              <Label htmlFor="share-email">Invite by email</Label>
              <div className="flex gap-2">
                <Input
                  id="share-email"
                  value={emailDraft}
                  placeholder="name@example.com"
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addEmail}>
                  Add
                </Button>
              </div>

              {emails.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {emails.map((email) => (
                    <li
                      key={email}
                      className="bg-secondary flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                    >
                      {email}
                      <button
                        type="button"
                        aria-label={`Remove ${email}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setEmails((current) => current.filter((e) => e !== email))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button disabled={!canCreate || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating…' : 'Create link'}
          </Button>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium">Existing links</h3>

            {shares.isPending && <Skeleton className="h-16 w-full" />}
            {shares.isError && (
              <p className="text-destructive text-sm">{describeError(shares.error)}</p>
            )}
            {shares.isSuccess && (
              <ShareList
                shares={shares.data}
                onRevoked={() => void queryClient.invalidateQueries({ queryKey: sharesKey })}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
