import { apiFetch } from './client';
import type { CreateUploadUrlRequest, FileDetail, UploadTarget } from './types';

export function createUploadUrl(body: CreateUploadUrlRequest): Promise<UploadTarget> {
  return apiFetch<UploadTarget>('/files/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function completeUpload(fileId: string): Promise<FileDetail> {
  return apiFetch<FileDetail>(`/files/${fileId}/complete`, { method: 'POST' });
}

/** Also used to clean up after a cancelled upload. */
export function deleteFile(fileId: string): Promise<void> {
  return apiFetch<void>(`/files/${fileId}`, { method: 'DELETE' });
}
