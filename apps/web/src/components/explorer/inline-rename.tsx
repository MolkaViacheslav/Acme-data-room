'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { splitFileName } from '@/lib/explorer/format';

interface InlineRenameProps {
  readonly initialName: string;
  readonly onCommit: (name: string) => void;
  readonly onCancel: () => void;
}

export function InlineRename({ initialName, onCommit, onCancel }: InlineRenameProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  // Blur commits, but not when Escape caused it.
  const cancelled = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;

    input.focus();
    // Select the stem only: the extension is almost never what is being changed.
    const { stem } = splitFileName(initialName);
    input.setSelectionRange(0, stem.length);
  }, [initialName]);

  function commit(): void {
    if (cancelled.current) return;

    const trimmed = value.trim();

    if (trimmed === '' || trimmed === initialName) {
      onCancel();
      return;
    }

    onCommit(trimmed);
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      aria-label={`Rename ${initialName}`}
      className="h-8"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          onCancel();
        }
      }}
    />
  );
}
