import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Data Room',
  description: 'A secure document repository for sharing acquisition materials.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
