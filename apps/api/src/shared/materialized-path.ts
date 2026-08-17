/**
 * Rules for `Folder.path`, the materialized path that makes "everything under
 * this folder" a single indexed prefix query.
 *
 * The shape is always `/<rootId>/<childId>/<grandchildId>/` — bounded by a
 * slash at both ends. That trailing slash is a safety property, not cosmetics:
 * without it `/root/legal` matches `/root/legalese/` and a prefix query leaks a
 * sibling subtree. Every function here preserves it, and anything malformed is
 * rejected rather than repaired.
 *
 * `decideAccess` depends on `isPathAncestorOrSelf`, so this rule is defined
 * exactly once.
 */

export function isWellFormedPath(path: string): boolean {
  return path.startsWith('/') && path.endsWith('/') && path.length > 1;
}

export function rootPath(rootFolderId: string): string {
  return `/${rootFolderId}/`;
}

export function childPath(parentPath: string, folderId: string): string {
  return `${parentPath}${folderId}/`;
}

/** True when `descendantPath` is `ancestorPath` or sits beneath it. */
export function isPathAncestorOrSelf(ancestorPath: string, descendantPath: string): boolean {
  if (!isWellFormedPath(ancestorPath) || !isWellFormedPath(descendantPath)) return false;

  return descendantPath.startsWith(ancestorPath);
}

/** True when `descendantPath` sits strictly beneath `ancestorPath`. */
export function isStrictDescendant(ancestorPath: string, descendantPath: string): boolean {
  return isPathAncestorOrSelf(ancestorPath, descendantPath) && descendantPath !== ancestorPath;
}

/**
 * Rewrites a path when its subtree moves. Returns `null` if the path does not
 * actually sit under `oldPrefix`, so a bad rewrite cannot be applied silently.
 */
export function replacePathPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (!isPathAncestorOrSelf(oldPrefix, path)) return null;
  if (!isWellFormedPath(newPrefix)) return null;

  return `${newPrefix}${path.slice(oldPrefix.length)}`;
}

/** The folder ids along a path, root first. Empty for a malformed path. */
export function pathSegments(path: string): string[] {
  if (!isWellFormedPath(path)) return [];

  return path.split('/').filter((segment) => segment !== '');
}
