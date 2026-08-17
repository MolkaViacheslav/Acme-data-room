export interface BreadcrumbEntry {
  readonly id: string;
  readonly name: string;
}

export interface FolderDetail {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly dataRoomId: string;
  readonly isRoot: boolean;
  /** What the caller may do here, so the UI can hide controls that would 403. */
  readonly role: 'OWNER' | 'VIEWER';
  /**
   * Ancestors, outermost first, ending with this folder. Truncated to what the
   * caller may see: a recipient of a folder share must not learn the names of
   * folders above it.
   */
  readonly breadcrumb: readonly BreadcrumbEntry[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ChildFolderEntry {
  readonly type: 'folder';
  readonly id: string;
  readonly name: string;
  readonly updatedAt: Date;
}

export interface ChildFileEntry {
  readonly type: 'file';
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly updatedAt: Date;
}

export type ChildEntry = ChildFolderEntry | ChildFileEntry;

export interface ChildrenPage {
  readonly items: readonly ChildEntry[];
  /** Opaque; pass back as `?cursor=`. `null` means this was the last page. */
  readonly nextCursor: string | null;
}

export interface DeletePreview {
  readonly folderCount: number;
  readonly fileCount: number;
  readonly totalBytes: number;
}
