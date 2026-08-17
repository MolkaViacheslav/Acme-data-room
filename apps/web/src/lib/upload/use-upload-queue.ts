'use client';

import { useCallback, useRef, useState } from 'react';

import { completeUpload, createUploadUrl, deleteFile } from '@/lib/api/files';
import { describeError } from '@/lib/api/client';

import { UploadCancelledError, putWithProgress } from './put-with-progress';
import { rejectionReason } from './upload-limits';

export type UploadState =
  | { readonly kind: 'queued' }
  | { readonly kind: 'uploading'; readonly progress: number }
  | { readonly kind: 'done'; readonly storedName: string }
  | { readonly kind: 'failed'; readonly reason: string }
  /** Never sent: it failed the local checks. */
  | { readonly kind: 'rejected'; readonly reason: string };

export interface UploadEntry {
  readonly id: string;
  readonly file: File;
  readonly state: UploadState;
}

/**
 * Runs each file through: reserve a name -> PUT the bytes -> confirm.
 *
 * Every file is independent. One rejection or failure never stops the others,
 * and each can be cancelled or retried on its own.
 */
export function useUploadQueue(folderId: string, onUploaded?: () => void) {
  const [entries, setEntries] = useState<readonly UploadEntry[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  // Needed to delete the reserved row when an upload is cancelled mid-flight.
  const reservedFileIds = useRef(new Map<string, string>());

  const patch = useCallback((id: string, state: UploadState) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, state } : entry)),
    );
  }, []);

  const run = useCallback(
    async (entry: UploadEntry) => {
      const controller = new AbortController();
      controllers.current.set(entry.id, controller);

      try {
        patch(entry.id, { kind: 'uploading', progress: 0 });

        const target = await createUploadUrl({
          folderId,
          name: entry.file.name,
          mimeType: entry.file.type || 'application/pdf',
          sizeBytes: entry.file.size,
        });
        reservedFileIds.current.set(entry.id, target.fileId);

        await putWithProgress(
          target.uploadUrl,
          entry.file,
          (progress) => patch(entry.id, { kind: 'uploading', progress }),
          controller.signal,
        );

        const stored = await completeUpload(target.fileId);

        patch(entry.id, { kind: 'done', storedName: stored.name });
        reservedFileIds.current.delete(entry.id);
        onUploaded?.();
      } catch (error) {
        const reservedId = reservedFileIds.current.get(entry.id);

        // Leaving the reserved row behind would hold its name against a retry.
        if (reservedId !== undefined) {
          await deleteFile(reservedId).catch(() => undefined);
          reservedFileIds.current.delete(entry.id);
        }

        setEntries((current) =>
          error instanceof UploadCancelledError
            ? current.filter((item) => item.id !== entry.id)
            : current.map((item) =>
                item.id === entry.id
                  ? { ...item, state: { kind: 'failed', reason: describeError(error) } }
                  : item,
              ),
        );
      } finally {
        controllers.current.delete(entry.id);
      }
    },
    [folderId, onUploaded, patch],
  );

  const add = useCallback(
    (files: readonly File[]) => {
      const incoming: UploadEntry[] = files.map((file) => {
        const reason = rejectionReason(file);

        return {
          id: crypto.randomUUID(),
          file,
          state: reason === null ? { kind: 'queued' } : { kind: 'rejected', reason },
        };
      });

      setEntries((current) => [...current, ...incoming]);

      for (const entry of incoming) {
        if (entry.state.kind === 'queued') void run(entry);
      }
    },
    [run],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
  }, []);

  const retry = useCallback(
    (id: string) => {
      const entry = entries.find((item) => item.id === id);
      if (entry !== undefined) void run(entry);
    },
    [entries, run],
  );

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setEntries((current) =>
      current.filter((entry) => entry.state.kind === 'uploading' || entry.state.kind === 'queued'),
    );
  }, []);

  return { entries, add, cancel, retry, dismiss, clearFinished };
}
