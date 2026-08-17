'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUploadQueue } from '@/lib/upload/use-upload-queue';

import { DropZone } from './drop-zone';
import { UploadItem } from './upload-item';

/**
 * Self-contained: it needs nothing but the folder to upload into, so it moves
 * into the explorer in the next phase unchanged.
 */
interface UploadPanelProps {
  readonly folderId: string;
  /** Lets the surrounding view refresh its listing once a file lands. */
  readonly onUploaded?: () => void;
}

export function UploadPanel({ folderId, onUploaded }: UploadPanelProps) {
  const { entries, add, cancel, retry, dismiss, clearFinished } = useUploadQueue(
    folderId,
    onUploaded,
  );

  const settled = entries.filter(
    (entry) => entry.state.kind !== 'uploading' && entry.state.kind !== 'queued',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload documents</CardTitle>
        <CardDescription>PDFs go straight to storage — they never pass through the API.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <DropZone onFiles={add} />

        {entries.length > 0 && (
          <div>
            <ul className="divide-border divide-y">
              {entries.map((entry) => (
                <UploadItem
                  key={entry.id}
                  entry={entry}
                  onCancel={cancel}
                  onRetry={retry}
                  onDismiss={dismiss}
                />
              ))}
            </ul>

            {settled.length > 0 && (
              <div className="flex justify-end pt-3">
                <Button variant="ghost" size="sm" onClick={clearFinished}>
                  Clear finished
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
