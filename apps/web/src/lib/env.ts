/**
 * `NEXT_PUBLIC_*` values are inlined at build time, so they must be referenced
 * as full literal property accesses — do not destructure `process.env`.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;

  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Copy apps/web/.env.example to .env.local and point it at the API.',
    );
  }

  // Trailing slashes would produce `//health` once we append a path.
  return raw.trim().replace(/\/+$/, '');
}
