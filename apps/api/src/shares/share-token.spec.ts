import { generateShareToken } from './share-token';

describe('generateShareToken', () => {
  it('is url-safe', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('carries 32 bytes of randomness', () => {
    // base64url of 32 bytes, unpadded.
    expect(generateShareToken()).toHaveLength(43);
  });

  it('does not repeat', () => {
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      seen.add(generateShareToken());
    }

    expect(seen.size).toBe(1000);
  });
});
