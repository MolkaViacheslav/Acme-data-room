/** Thrown when the caller cancelled, so it can be told apart from a failure. */
export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled.');
    this.name = 'UploadCancelledError';
  }
}

/**
 * Uploads the file straight to storage, reporting progress as it goes.
 *
 * `XMLHttpRequest` rather than `fetch` for one reason: `fetch` cannot report
 * upload progress. There is no request body stream to observe, so a progress
 * bar over `fetch` can only ever be a guess.
 */
export function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadCancelledError());
      return;
    }

    const request = new XMLHttpRequest();

    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type || 'application/pdf');

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage refused the file (${request.status}).`));
    });

    request.addEventListener('error', () => {
      reject(new Error('The upload failed. Check your connection and try again.'));
    });

    request.addEventListener('abort', () => {
      reject(new UploadCancelledError());
    });

    signal.addEventListener('abort', () => request.abort(), { once: true });

    request.send(file);
  });
}
