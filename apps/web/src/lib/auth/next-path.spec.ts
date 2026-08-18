import { safeNextPath, withNext } from './next-path';

/** `/\evil.example`, spelled without relying on escaping being read correctly. */
const BACKSLASH_PATH = `/${String.fromCharCode(92)}evil.example`;

const REFUSED: readonly { raw: string | null; why: string }[] = [
  { raw: '//evil.example/steal', why: 'protocol-relative URL' },
  { raw: 'https://evil.example', why: 'absolute URL' },
  { raw: BACKSLASH_PATH, why: 'backslash some browsers read as a slash' },
  { raw: 'javascript:alert(1)', why: 'script URL' },
  { raw: '', why: 'empty' },
  { raw: null, why: 'absent' },
];

describe('safeNextPath', () => {
  it('keeps a same-site path', () => {
    expect(safeNextPath('/share/abc/folder-1')).toBe('/share/abc/folder-1');
  });

  it('keeps a path with a query string', () => {
    expect(safeNextPath('/d/f1?sort=size')).toBe('/d/f1?sort=size');
  });

  it.each(REFUSED)('refuses a $why', ({ raw }) => {
    expect(safeNextPath(raw)).toBe('/');
  });
});

describe('withNext', () => {
  it('carries the destination', () => {
    expect(withNext('/login', '/share/abc/folder-1')).toBe('/login?next=%2Fshare%2Fabc%2Ffolder-1');
  });

  it('adds nothing when there is nowhere to go back to', () => {
    expect(withNext('/login', null)).toBe('/login');
  });

  it('drops a destination that is not same-site', () => {
    expect(withNext('/login', 'https://evil.example')).toBe('/login');
  });
});
