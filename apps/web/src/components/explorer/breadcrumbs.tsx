import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import type { BreadcrumbEntry } from '@/lib/api/types';

/** Beyond this, the middle collapses to an ellipsis. */
const MAX_VISIBLE = 4;

interface Segment {
  readonly kind: 'entry' | 'ellipsis';
  readonly entry?: BreadcrumbEntry;
}

/**
 * Keeps the first and the last two, because those are what orient you: where
 * the drive starts, and where you are now.
 */
function collapse(trail: readonly BreadcrumbEntry[]): Segment[] {
  if (trail.length <= MAX_VISIBLE) {
    return trail.map((entry) => ({ kind: 'entry', entry }));
  }

  const first = trail[0];
  const tail = trail.slice(-2);

  return [
    ...(first === undefined ? [] : [{ kind: 'entry' as const, entry: first }]),
    { kind: 'ellipsis' as const },
    ...tail.map((entry) => ({ kind: 'entry' as const, entry })),
  ];
}

export function Breadcrumbs({ trail }: { trail: readonly BreadcrumbEntry[] }) {
  const segments = collapse(trail);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <li key={segment.entry?.id ?? `ellipsis-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />}

              {segment.kind === 'ellipsis' ? (
                <span aria-label="Skipped folders">…</span>
              ) : isLast ? (
                <span aria-current="page" className="text-foreground font-medium">
                  {segment.entry?.name}
                </span>
              ) : (
                <Link
                  href={`/d/${segment.entry?.id ?? ''}`}
                  className="hover:text-foreground transition-colors"
                >
                  {segment.entry?.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
