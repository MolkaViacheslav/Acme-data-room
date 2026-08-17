import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SessionErrorProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retrying: boolean;
}

export function SessionError({ message, onRetry, retrying }: SessionErrorProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-destructive size-5 shrink-0" />
          <div className="grid gap-1">
            <CardTitle>Could not load your account</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      </CardContent>
    </Card>
  );
}
