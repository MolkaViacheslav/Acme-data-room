import { HomeRedirect } from '@/components/home/home-redirect';

/**
 * The drive lives at `/d/[folderId]`, but the caller's root folder id is only
 * known once the session resolves — and the session can only be read in the
 * browser, because the auth cookie belongs to the API's origin.
 */
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <HomeRedirect />
    </main>
  );
}
