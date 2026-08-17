'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { renameFile } from '@/lib/api/files';
import {
  type ChildSortField,
  type SortDirection,
  fetchFolder,
  fetchFolderChildren,
  renameFolder,
} from '@/lib/api/folders';
import type { ChildEntry, ChildrenPage, FolderDetail } from '@/lib/api/types';

export const folderKeys = {
  detail: (id: string) => ['folder', id, 'detail'] as const,
  children: (id: string, sort: ChildSortField, direction: SortDirection) =>
    ['folder', id, 'children', sort, direction] as const,
  /** Every sort variant of one folder's listing. */
  anyChildren: (id: string) => ['folder', id, 'children'] as const,
  deletePreview: (id: string) => ['folder', id, 'delete-preview'] as const,
};

export function useFolder(id: string) {
  return useQuery({ queryKey: folderKeys.detail(id), queryFn: () => fetchFolder(id) });
}

export function useFolderChildren(id: string, sort: ChildSortField, direction: SortDirection) {
  return useInfiniteQuery({
    queryKey: folderKeys.children(id, sort, direction),
    queryFn: ({ pageParam }) =>
      fetchFolderChildren(id, { sort, direction, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: ChildrenPage) => lastPage.nextCursor,
  });
}

type ChildrenCache = InfiniteData<ChildrenPage, string | null>;

function renameInCache(cache: ChildrenCache, entryId: string, name: string): ChildrenCache {
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((item): ChildEntry =>
        item.id === entryId ? { ...item, name } : item,
      ),
    })),
  };
}

/**
 * Renames a row and shows the new name immediately.
 *
 * The whole listing is snapshotted before the change and restored if the server
 * refuses — a rename that collides is common enough that reverting has to be
 * exact rather than approximate.
 */
export function useRenameEntry(folderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // The updated entity is not used — the listing is refetched — so the result
    // is dropped rather than widened into a union of two shapes.
    mutationFn: async ({ entry, name }: { entry: ChildEntry; name: string }): Promise<void> => {
      if (entry.type === 'folder') {
        await renameFolder(entry.id, name);
      } else {
        await renameFile(entry.id, name);
      }
    },

    onMutate: async ({ entry, name }) => {
      const key = folderKeys.anyChildren(folderId);
      await queryClient.cancelQueries({ queryKey: key });

      const snapshot = queryClient.getQueriesData<ChildrenCache>({ queryKey: key });

      queryClient.setQueriesData<ChildrenCache>({ queryKey: key }, (cache) =>
        cache === undefined ? cache : renameInCache(cache, entry.id, name),
      );

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [key, cache] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, cache);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: folderKeys.anyChildren(folderId) });
    },
  });
}

/** Everything a mutation touching this folder should refresh. */
export function useInvalidateFolder(folderId: string) {
  const queryClient = useQueryClient();

  return (alsoFolderId?: string) => {
    void queryClient.invalidateQueries({ queryKey: folderKeys.anyChildren(folderId) });
    void queryClient.invalidateQueries({ queryKey: folderKeys.deletePreview(folderId) });

    if (alsoFolderId !== undefined && alsoFolderId !== folderId) {
      void queryClient.invalidateQueries({ queryKey: folderKeys.anyChildren(alsoFolderId) });
    }
  };
}

export type { FolderDetail };
