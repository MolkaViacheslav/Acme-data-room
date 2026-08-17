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
