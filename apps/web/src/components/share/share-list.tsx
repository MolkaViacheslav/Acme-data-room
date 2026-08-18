'use client';

import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Link2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { describeError } from '@/lib/api/client';
import { revokeShare, shareLinkFor } from '@/lib/api/shares';
import type { ShareSummary } from '@/lib/api/types';

export function ShareList({
  shares,
  onRevoked,
}: {
  readonly shares: readonly ShareSummary[];
  readonly onRevoked: () => void;
}) {
  if (shares.length === 0) {
    return <p className="text-muted-foreground text-sm">No links yet.</p>;
  }

  return (
    <ul className="divide-border divide-y">
      {shares.map((share) => (
        <ShareRow key={share.id} share={share} onRevoked={onRevoked} />
      ))}
    </ul>
  );
}

function ShareRow({
  share,
  onRevoked,
}: {
  readonly share: ShareSummary;
  readonly onRevoked: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const revoke = useMutation({
    mutationFn: () => revokeShare(share.id),
    onSuccess: () => {
      toast.success('Link revoked. It stops working immediately.');
      onRevoked();
    },
    onError: (error: unknown) => toast.error(describeError(error)),
  });

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareLinkFor(share.token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Copy the link from the address bar instead.');
    }
  }

  return (
    <li className="flex items-center gap-3 py-2">
      {share.mode === 'PUBLIC_LINK' ? (
        <Link2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
      ) : (
        <Users className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {share.mode === 'PUBLIC_LINK'
            ? 'Anyone with the link'
            : share.recipientEmails.join(', ')}
        </p>
        {share.expiresAt !== null && (
          <p className="text-muted-foreground text-xs">
            Expires {new Date(share.expiresAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={() => void copy()}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
        className="text-destructive hover:text-destructive"
      >
        {revoke.isPending ? 'Revoking…' : 'Revoke'}
      </Button>
    </li>
  );
}
