import type { Metadata } from 'next';

import { ShareGate } from '@/components/share/share-gate';

export const metadata: Metadata = { title: 'Shared — Data Room' };

export default async function SharedFolderPage({
  params,
}: PageProps<'/share/[token]/[folderId]'>) {
  const { token, folderId } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <ShareGate token={token} folderId={folderId} />
    </main>
  );
}
