import { Suspense } from 'react';

import { AuthGate } from '@/components/auth/auth-gate';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Data Room</h1>

      {/* `AuthGate` and the sign-in form both read `?next=`, which a statically
          prerendered page may only do inside a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-sm rounded-xl" />}>
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </main>
  );
}
