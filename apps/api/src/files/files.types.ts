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

export interface DownloadUrl {
  readonly url: string;
  /** When the link stops working, so the client knows to ask for another. */
  readonly expiresAt: Date;
}
