import type { Metadata } from 'next';

import { ExplorerView } from '@/components/explorer/explorer-view';

export const metadata: Metadata = {
  title: 'Data Room',
};

export default async function FolderPage({ params }: PageProps<'/d/[folderId]'>) {
  const { folderId } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <ExplorerView folderId={folderId} />
    </main>
  );
}
