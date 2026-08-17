'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/api/client';
import { fetchDownloadUrl } from '@/lib/api/files';

interface PdfViewerDialogProps {
  readonly fileId: string;
  readonly fileName: string;
  readonly onClose: () => void;
}

/**
 * Takes a file id and nothing else, so the shared-link view can reuse it as is.
 *
 * The signed URL is short-lived by design. Once the iframe has the document it
 * keeps it, but any reload needs a fresh link — hence the retry, which asks for
 * a new URL rather than replaying the expired one.
 */
export function PdfViewerDialog({ fileId, fileName, onClose }: PdfViewerDialogProps) {
  const link = useQuery({
    queryKey: ['file', fileId, 'download-url'],
    queryFn: () => fetchDownloadUrl(fileId),
    // Never reuse a cached URL: it may already have expired.
    gcTime: 0,
    staleTime: 0,
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-4">
        {/* `pe-10` keeps this row clear of the close button, which the dialog
            positions absolutely in the same corner. */}
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pe-10">
          <div className="min-w-0">
            <DialogTitle className="truncate">{fileName}</DialogTitle>
            <DialogDescription>Opened from a short-lived signed link.</DialogDescription>
          </div>

          {link.isSuccess && (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a href={link.data.url} download={fileName} target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Download
              </a>
            </Button>
          )}
        </DialogHeader>

        {link.isPending && <Skeleton className="flex-1 rounded-md" />}

        {link.isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed text-center">
            <p className="text-sm font-medium">This document could not be opened</p>
            <p className="text-muted-foreground max-w-sm text-sm">{describeError(link.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void link.refetch()}>
              <RotateCw className="size-4" />
              Try again
            </Button>
          </div>
        )}

        {link.isSuccess && (
          <iframe
            src={link.data.url}
            title={fileName}
            className="bg-muted flex-1 rounded-md border"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
