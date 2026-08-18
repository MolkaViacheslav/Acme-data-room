'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PdfViewerDialog } from '@/components/viewer/pdf-viewer-dialog';

interface SharedFileViewProps {
  readonly fileId: string;
  readonly fileName: string;
  readonly dataRoomName: string;
  readonly token: string;
}

/**
 * A single shared file, and nothing else.
 *
 * The viewer opens straight away so the link feels direct, but closing it comes
 * back here rather than navigating away. It used to send the visitor to `/`,
 * which for anyone signed in meant landing in their own data room — alarming to
 * read as "the share showed me everything", even though nothing had leaked.
 *
 * There is deliberately no folder, no listing and no way up: a file share grants
 * the file, and the API refuses anything else with this token.
 */
export function SharedFileView({ fileId, fileName, dataRoomName, token }: SharedFileViewProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <FileText className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <CardTitle className="truncate">{fileName}</CardTitle>
              <CardDescription>Shared with you from {dataRoomName}.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Button onClick={() => setIsOpen(true)}>Open document</Button>
        </CardContent>
      </Card>

      {isOpen && (
        <PdfViewerDialog
          fileId={fileId}
          fileName={fileName}
          token={token}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
