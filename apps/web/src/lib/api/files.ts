import { apiFetch } from './client';
import type { CreateUploadUrlRequest, DownloadUrl, FileDetail, UploadTarget } from './types';

export function renameFile(id: string, name: string): Promise<FileDetail> {
  return apiFetch<FileDetail>(`/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function moveFile(id: string, folderId: string): Promise<FileDetail> {
  return apiFetch<FileDetail>(`/files/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId }),
  });
}

export function fetchDownloadUrl(id: string, token?: string): Promise<DownloadUrl> {
  const suffix = token === undefined ? '' : `?token=${encodeURIComponent(token)}`;

  return apiFetch<DownloadUrl>(`/files/${id}/download-url${suffix}`, { cache: 'no-store' });
}

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
