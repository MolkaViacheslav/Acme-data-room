import type { NextConfig } from 'next';

/**
 * Where the API actually lives. Server-side only — the browser never sees it.
 */
const apiOrigin = process.env.API_ORIGIN?.trim().replace(/\/+$/, '');

const nextConfig: NextConfig = {
  /**
   * Serves the API from this site's own origin.
   *
   * Without it the frontend and the API are different sites, which makes the
   * auth cookie a *third-party* cookie — and browsers that block those (Chrome
   * incognito does by default) accept the sign-in response and silently discard
   * it. Proxying makes the cookie first-party, so signing in works wherever the
   * app does.
   *
   * The backend stays a separate deployment on Railway; only the browser's path
   * to it changes. Uploads are unaffected — they go straight from the browser to
   * Supabase Storage and never pass through here.
   *
   * Absent `API_ORIGIN`, no rewrite is added and the app talks to whatever
   * `NEXT_PUBLIC_API_URL` points at, exactly as before.
   */
  async rewrites() {
    if (apiOrigin === undefined || apiOrigin === '') return [];

    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
