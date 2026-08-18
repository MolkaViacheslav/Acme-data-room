import { apiFetch } from './client';
import type { ChildrenPage, DeletePreview, FolderDetail } from './types';

export type ChildSortField = 'name' | 'size' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface ListChildrenParams {
  readonly cursor?: string;
  readonly limit?: number;
  readonly sort?: ChildSortField;
  readonly direction?: SortDirection;
  /** Present when browsing through a share link. */
  readonly token?: string;
}

export function fetchFolder(id: string, token?: string): Promise<FolderDetail> {
  const suffix = token === undefined ? '' : `?token=${encodeURIComponent(token)}`;

  return apiFetch<FolderDetail>(`/folders/${id}${suffix}`, { cache: 'no-store' });
}

export function fetchFolderChildren(
  id: string,
  params: ListChildrenParams = {},
): Promise<ChildrenPage> {
  const query = new URLSearchParams();

  if (params.cursor !== undefined) query.set('cursor', params.cursor);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.sort !== undefined) query.set('sort', params.sort);
  if (params.direction !== undefined) query.set('direction', params.direction);
  if (params.token !== undefined) query.set('token', params.token);

  const suffix = query.size === 0 ? '' : `?${query.toString()}`;

  return apiFetch<ChildrenPage>(`/folders/${id}/children${suffix}`, { cache: 'no-store' });
}

export function createFolder(body: { name: string; parentId: string }): Promise<FolderDetail> {
  return apiFetch<FolderDetail>('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function renameFolder(id: string, name: string): Promise<FolderDetail> {
  return apiFetch<FolderDetail>(`/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function moveFolder(id: string, parentId: string): Promise<FolderDetail> {
  return apiFetch<FolderDetail>(`/folders/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId }),
  });
}

export function fetchDeletePreview(id: string): Promise<DeletePreview> {
  return apiFetch<DeletePreview>(`/folders/${id}/delete-preview`, { cache: 'no-store' });
}

export function deleteFolder(id: string): Promise<void> {
  return apiFetch<void>(`/folders/${id}`, { method: 'DELETE' });
}
