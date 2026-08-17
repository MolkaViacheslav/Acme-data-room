import { ApiStatusCard } from '@/components/health/api-status-card';
import { checkApiHealth } from '@/lib/api/health';

// The point of this page is to prove the *deployed* frontend can reach the
// *deployed* API, so it must run per request rather than at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const status = await checkApiHealth();

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Data Room</h1>
        <p className="text-muted-foreground text-sm">
          A secure document repository. Deployment skeleton — no features yet.
        </p>
      </header>

      <ApiStatusCard status={status} />
    </main>
  );
}
