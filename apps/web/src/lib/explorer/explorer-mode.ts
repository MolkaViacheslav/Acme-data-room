/**
 * How the explorer is being viewed.
 *
 * The owner's drive and a shared link render the *same* components; only the
 * addressing differs. Read-only behaviour is not part of this — the API
 * reports the caller's role, and the explorer hides controls based on that, so
 * a share needs no separate flag.
 */
export interface ExplorerMode {
  /** Present when browsing through a share link; sent with every request. */
  readonly token?: string;
  /** Where a folder row and a breadcrumb link should point. */
  readonly hrefFor: (folderId: string) => string;
}

export const ownerMode: ExplorerMode = {
  hrefFor: (folderId) => `/d/${folderId}`,
};

export function shareMode(token: string): ExplorerMode {
  return { token, hrefFor: (folderId) => `/share/${token}/${folderId}` };
}
