'use client';

import { AlertTriangle, Check, FileText, RotateCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/upload/upload-limits';
import type { UploadEntry } from '@/lib/upload/use-upload-queue';

interface UploadItemProps {
  readonly entry: UploadEntry;
  readonly onCancel: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onDismiss: (id: string) => void;
}

export function UploadItem({ entry, onCancel, onRetry, onDismiss }: UploadItemProps) {
  const { state } = entry;
  const failed = state.kind === 'failed' || state.kind === 'rejected';

  return (
    <li className="flex items-start gap-3 py-3">
      {failed ? (
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      ) : state.kind === 'done' ? (
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{entry.file.name}</p>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatBytes(entry.file.size)}
          </span>
        </div>

        {state.kind === 'uploading' && (
          <Progress value={Math.round(state.progress * 100)} className="h-1.5" />
        )}

        {state.kind === 'queued' && <p className="text-muted-foreground text-xs">Waiting…</p>}

        {state.kind === 'done' && (
          <p className="text-muted-foreground text-xs">
            Uploaded
            {state.storedName === entry.file.name ? '' : ` as “${state.storedName}”`}
          </p>
        )}

        {failed && <p className="text-destructive text-xs">{state.reason}</p>}
      </div>

      <div className="shrink-0">
        {state.kind === 'uploading' && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(entry.id)}>
            Cancel
          </Button>
        )}

        {state.kind === 'failed' && (
          <Button variant="ghost" size="sm" onClick={() => onRetry(entry.id)}>
            <RotateCw className="size-3.5" />
            Retry
          </Button>
        )}

        {(state.kind === 'rejected' || state.kind === 'done') && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Dismiss ${entry.file.name}`}
            onClick={() => onDismiss(entry.id)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
