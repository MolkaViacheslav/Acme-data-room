import { RedirectWhenSignedIn } from '@/components/auth/redirect-when-signed-in';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12">
      <RedirectWhenSignedIn />
      <h1 className="text-xl font-semibold tracking-tight">Data Room</h1>
      {children}
    </main>
  );
}
