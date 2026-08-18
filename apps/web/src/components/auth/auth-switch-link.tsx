'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { withNext } from '@/lib/auth/next-path';

/**
 * Switches between sign-in and sign-up while keeping `?next=`.
 *
 * Without this, following a share link and then choosing "create one" dropped
 * the destination, so the new account landed in its own drive instead of back
 * at the link that sent them there.
 */
export function AuthSwitchLink({ href, label }: { readonly href: string; readonly label: string }) {
  const searchParams = useSearchParams();

  return (
    <Link
      href={withNext(href, searchParams.get('next'))}
      className="text-foreground font-medium underline underline-offset-4"
    >
      {label}
    </Link>
  );
}
