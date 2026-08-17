import {
  childPath,
  isPathAncestorOrSelf,
  isStrictDescendant,
  isWellFormedPath,
  pathSegments,
  replacePathPrefix,
  rootPath,
} from './materialized-path';

describe('isWellFormedPath', () => {
  it.each([
    ['/root/', true],
    ['/root/child/', true],
    ['/root', false],
    ['root/', false],
    ['/', false],
    ['', false],
  ])('%s -> %s', (path, expected) => {
    expect(isWellFormedPath(path)).toBe(expected);
  });
});

describe('rootPath and childPath', () => {
  it('bounds a root path with slashes', () => {
    expect(rootPath('r1')).toBe('/r1/');
  });

  it('appends a child while keeping the trailing slash', () => {
    expect(childPath('/r1/', 'c1')).toBe('/r1/c1/');
    expect(childPath(childPath('/r1/', 'c1'), 'g1')).toBe('/r1/c1/g1/');
  });
});

describe('isPathAncestorOrSelf', () => {
  it('matches a folder against itself', () => {
    expect(isPathAncestorOrSelf('/r1/legal/', '/r1/legal/')).toBe(true);
  });

  it('matches a descendant', () => {
    expect(isPathAncestorOrSelf('/r1/legal/', '/r1/legal/contracts/')).toBe(true);
  });

  it('does not match a sibling whose id starts with the same characters', () => {
    expect(isPathAncestorOrSelf('/r1/legal/', '/r1/legalese/')).toBe(false);
  });

  it('does not match upwards', () => {
    expect(isPathAncestorOrSelf('/r1/legal/contracts/', '/r1/legal/')).toBe(false);
  });

  it('refuses malformed input rather than repairing it', () => {
    expect(isPathAncestorOrSelf('/r1/legal', '/r1/legalese/')).toBe(false);
    expect(isPathAncestorOrSelf('/r1/legal/', 'r1/legal/contracts/')).toBe(false);
  });
});

describe('isStrictDescendant', () => {
  it('excludes the folder itself', () => {
    expect(isStrictDescendant('/r1/legal/', '/r1/legal/')).toBe(false);
    expect(isStrictDescendant('/r1/legal/', '/r1/legal/contracts/')).toBe(true);
  });
});

describe('replacePathPrefix', () => {
  it('rewrites the moved folder itself', () => {
    expect(replacePathPrefix('/r1/legal/', '/r1/legal/', '/r1/archive/legal/')).toBe(
      '/r1/archive/legal/',
    );
  });

  it('rewrites a descendant, preserving the tail', () => {
    expect(replacePathPrefix('/r1/legal/contracts/msa/', '/r1/legal/', '/r1/archive/legal/')).toBe(
      '/r1/archive/legal/contracts/msa/',
    );
  });

  it('refuses a path that does not sit under the old prefix', () => {
    expect(replacePathPrefix('/r1/finance/', '/r1/legal/', '/r1/archive/legal/')).toBeNull();
  });

  it('refuses a malformed replacement prefix', () => {
    expect(replacePathPrefix('/r1/legal/', '/r1/legal/', '/r1/archive/legal')).toBeNull();
  });
});

describe('pathSegments', () => {
  it('lists folder ids root first', () => {
    expect(pathSegments('/r1/legal/contracts/')).toEqual(['r1', 'legal', 'contracts']);
  });

  it('returns nothing for a malformed path', () => {
    expect(pathSegments('r1/legal/')).toEqual([]);
  });
});
