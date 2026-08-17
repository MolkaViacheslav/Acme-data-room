import { CheckCircle2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ApiStatus } from '@/lib/api/health';

export function ApiStatusBadge({ status }: { status: ApiStatus }) {
  if (status.state === 'reachable') {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        Reachable
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1.5">
      <XCircle className="size-3.5" />
      Unreachable
    </Badge>
  );
}
