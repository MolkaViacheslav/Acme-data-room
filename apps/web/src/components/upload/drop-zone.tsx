'use client';

import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ALLOWED_EXTENSION, MAX_UPLOAD_BYTES, formatBytes } from '@/lib/upload/upload-limits';
import { cn } from '@/lib/utils';

export function DropZone({ onFiles }: { onFiles: (files: readonly File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
        isDraggingOver ? 'border-primary bg-accent' : 'border-border',
      )}
    >
      <Upload className="text-muted-foreground size-6" aria-hidden />

      <div className="space-y-1">
        <p className="text-sm font-medium">Drop PDFs here</p>
        <p className="text-muted-foreground text-sm">
          Up to {formatBytes(MAX_UPLOAD_BYTES)} each.
        </p>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        Choose files
      </Button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={`${ALLOWED_EXTENSION},application/pdf`}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          // Reset so choosing the same file twice fires a change event again.
          event.target.value = '';
        }}
      />
    </div>
  );
}
