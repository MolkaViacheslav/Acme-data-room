import { Ban, Clock, FileQuestion, LogIn } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export type ShareProblem = 'REVOKED' | 'EXPIRED' | 'GONE' | 'SIGN_IN_REQUIRED' | 'NOT_INVITED';

const COPY: Record<ShareProblem, { icon: typeof Ban; title: string; body: string }> = {
  REVOKED: {
    icon: Ban,
    title: 'Access to this item has been revoked',
    body: 'The person who shared it has turned the link off.',
  },
  EXPIRED: {
    icon: Clock,
    title: 'This link has expired',
    body: 'It was shared with an end date that has now passed. Ask for a new link.',
  },
  GONE: {
    icon: FileQuestion,
    title: 'This item is no longer available',
    body: 'It may have been deleted by the person who shared it.',
  },
  SIGN_IN_REQUIRED: {
    icon: LogIn,
    title: 'Sign in to open this',
    body: 'This link was shared with specific people. Sign in to confirm it was shared with you.',
  },
  NOT_INVITED: {
    icon: Ban,
    title: 'This link was shared with a different account',
    body: 'Sign in with the address it was sent to, or ask for a new link.',
  },
};

interface ShareUnavailableProps {
  readonly problem: ShareProblem;
  /** Where to send someone who needs to sign in and come back. */
  readonly signInHref?: string;
}

export function ShareUnavailable({ problem, signInHref }: ShareUnavailableProps) {
  const { icon: Icon, title, body } = COPY[problem];
  const needsSignIn = problem === 'SIGN_IN_REQUIRED' || problem === 'NOT_INVITED';

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <Icon className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{body}</p>

      <div className="flex gap-2 pt-2">
        {needsSignIn && signInHref !== undefined && (
          <Button asChild size="sm">
            <Link href={signInHref}>Sign in</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/">Go to your data room</Link>
        </Button>
      </div>
    </div>
  );
}
