import type { ShareResourceType } from '../access/access.types';

export interface ShareSummary {
  readonly id: string;
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  readonly mode: 'PUBLIC_LINK' | 'RESTRICTED';
  readonly token: string;
  readonly recipientEmails: readonly string[];
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

/** What `/share/<token>` needs in order to decide what to render. */
export interface SharedResource {
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  readonly name: string;
  readonly dataRoomName: string;
  /** The folder to open, or `null` when a single file was shared. */
  readonly folderId: string | null;
  /** The file to open, or `null` otherwise. */
  readonly fileId: string | null;
}
