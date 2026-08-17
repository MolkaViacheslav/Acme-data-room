/**
 * Mirrors `apps/api/src/files/upload-limits.ts`, kept in sync by hand.
 *
 * Checking here is a courtesy: it lets a 400 MB video be rejected instantly
 * instead of after a round trip. The API checks the claim again, and then
 * checks the stored object itself — that last one is the check that decides.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MIME_TYPE = 'application/pdf';
export const ALLOWED_EXTENSION = '.pdf';

/** Why a file will not be uploaded, phrased for the person who dropped it. */
export function rejectionReason(file: File): string | null {
  const looksLikePdf =
    file.type === ALLOWED_MIME_TYPE || file.name.toLowerCase().endsWith(ALLOWED_EXTENSION);

  if (!looksLikePdf) return 'Only PDF files can be uploaded.';
  if (file.size <= 0) return 'This file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller — this one is ${formatBytes(file.size)}.`;
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
