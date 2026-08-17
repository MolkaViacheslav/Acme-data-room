import { AuthGate } from '@/components/auth/auth-gate';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Data Room</h1>
      <AuthGate>{children}</AuthGate>
    </main>
  );
}
