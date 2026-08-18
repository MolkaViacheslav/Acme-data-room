/**
 * Compares in time proportional to the length of the input rather than to the
 * length of the matching prefix, so a caller cannot discover a secret one
 * character at a time.
 *
 * Length itself is not hidden, which is fine: share tokens are fixed width.
 * Written out rather than using `crypto.timingSafeEqual` so the access
 * decision stays free of imports and runs anywhere.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}
