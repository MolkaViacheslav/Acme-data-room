import type { Metadata } from 'next';

import { ShareGate } from '@/components/share/share-gate';

export const metadata: Metadata = { title: 'Shared — Data Room' };

export default async function SharePage({ params }: PageProps<'/share/[token]'>) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <ShareGate token={token} />
    </main>
  );
}
