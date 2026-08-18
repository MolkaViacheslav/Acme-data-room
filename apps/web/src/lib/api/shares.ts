import { apiFetch } from './client';
import type { CreateShareRequest, SharedResource, ShareResourceType, ShareSummary } from './types';

export function createShare(body: CreateShareRequest): Promise<ShareSummary> {
  return apiFetch<ShareSummary>('/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchShares(
  resourceType: ShareResourceType,
  resourceId: string,
): Promise<ShareSummary[]> {
  const query = new URLSearchParams({ resourceType, resourceId });

  return apiFetch<ShareSummary[]>(`/shares?${query.toString()}`, { cache: 'no-store' });
}

export function revokeShare(id: string): Promise<void> {
  return apiFetch<void>(`/shares/${id}`, { method: 'DELETE' });
}

export function resolveShareToken(token: string): Promise<SharedResource> {
  return apiFetch<SharedResource>(`/shares/by-token/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
}

/** The address a share link is handed out as. */
export function shareLinkFor(token: string): string {
  return `${window.location.origin}/share/${token}`;
}
