import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApiStatus } from '@/lib/api/health';

import { ApiStatusBadge } from './api-status-badge';

export function ApiStatusCard({ status }: { status: ApiStatus }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>API connection</CardTitle>
          <ApiStatusBadge status={status} />
        </div>
        <CardDescription>
          This page calls <code className="font-mono">GET /health</code> on the NestJS API.
        </CardDescription>
      </CardHeader>

      {status.state === 'unreachable' && (
        <CardContent>
          <p className="text-muted-foreground text-sm">{status.reason}</p>
        </CardContent>
      )}
    </Card>
  );
}
