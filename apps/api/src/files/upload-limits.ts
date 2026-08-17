export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MIME_TYPE = 'application/pdf';
export const ALLOWED_EXTENSION = '.pdf';

export type UploadRejection = 'NOT_A_PDF' | 'TOO_LARGE' | 'EMPTY';

export interface UploadCandidate {
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/**
 * The single definition of what may be uploaded, applied twice on purpose.
 *
 * Once against what the client *claims*, to fail fast before signing a URL; and
 * again in `complete` against what storage says is actually there. The second
 * pass is the one that counts — a signed upload URL constrains neither size nor
 * content type, so a client is free to declare a small PDF and send something
 * else. Phase 6 renders these in an iframe, which makes a mislabelled file a
 * security problem rather than a tidiness one.
 */
export function checkUploadLimits(candidate: UploadCandidate): UploadRejection | null {
  // A content type may carry parameters, e.g. `application/pdf; charset=binary`.
  const mimeType = candidate.mimeType.split(';')[0]?.trim().toLowerCase() ?? '';

  if (mimeType !== ALLOWED_MIME_TYPE) return 'NOT_A_PDF';
  if (candidate.sizeBytes <= 0) return 'EMPTY';
  if (candidate.sizeBytes > MAX_UPLOAD_BYTES) return 'TOO_LARGE';

  return null;
}

export function describeRejection(rejection: UploadRejection): string {
  switch (rejection) {
    case 'NOT_A_PDF':
      return 'Only PDF files can be uploaded.';
    case 'TOO_LARGE':
      return `Files must be ${formatMegabytes(MAX_UPLOAD_BYTES)} or smaller.`;
    case 'EMPTY':
      return 'This file is empty.';
  }
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
