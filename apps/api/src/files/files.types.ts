export interface FileDetail {
  readonly id: string;
  readonly name: string;
  readonly folderId: string;
  readonly dataRoomId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UploadTarget {
  /** The `File` row to confirm once the bytes are in place. */
  readonly fileId: string;
  /** The name actually taken — may differ from the one requested. */
  readonly name: string;
  /** `PUT` the file here. The token is embedded; no credentials needed. */
  readonly uploadUrl: string;
}

export interface DownloadUrl {
  readonly url: string;
  /** When the link stops working, so the client knows to ask for another. */
  readonly expiresAt: Date;
}
