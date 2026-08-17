/**
 * Request/response shapes shared with the NestJS API.
 *
 * Kept in sync with the backend DTOs by hand — see CLAUDE.md. When a DTO
 * changes in `apps/api`, change it here in the same commit.
 */

/** `GET /health` */
export interface HealthResponse {
  readonly ok: true;
}

/** `POST /auth/register` */
export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

/** `POST /auth/login` */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export type AccessRole = 'OWNER' | 'VIEWER';

export interface BreadcrumbEntry {
  readonly id: string;
  readonly name: string;
}

/** `GET /folders/:id` */
export interface FolderDetail {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly dataRoomId: string;
  readonly isRoot: boolean;
  /** What the caller may do here. Controls that would 403 are not rendered. */
  readonly role: AccessRole;
  readonly breadcrumb: readonly BreadcrumbEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChildFolderEntry {
  readonly type: 'folder';
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface ChildFileEntry {
  readonly type: 'file';
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly updatedAt: string;
}

export type ChildEntry = ChildFolderEntry | ChildFileEntry;

/** `GET /folders/:id/children` */
export interface ChildrenPage {
  readonly items: readonly ChildEntry[];
  readonly nextCursor: string | null;
}

/** `GET /folders/:id/delete-preview` */
export interface DeletePreview {
  readonly folderCount: number;
  readonly fileCount: number;
  readonly totalBytes: number;
}

/** `GET /files/:id/download-url` */
export interface DownloadUrl {
  readonly url: string;
  readonly expiresAt: string;
}

/** The 409 body from a rename, move or create that collides. */
export interface NameConflictBody {
  readonly message: string;
  readonly suggestedName?: string;
}

/** `POST /files/upload-url` */
export interface CreateUploadUrlRequest {
  readonly folderId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface UploadTarget {
  readonly fileId: string;
  /** The name actually taken — may differ from the one requested. */
  readonly name: string;
  readonly uploadUrl: string;
}

/** Returned by `POST /files/:id/complete`. */
export interface FileDetail {
  readonly id: string;
  readonly name: string;
  readonly folderId: string;
  readonly dataRoomId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Returned by `register`, `login` and `GET /auth/me`. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly dataRoom: {
    readonly id: string;
    readonly name: string;
    readonly rootFolderId: string;
  };
}
