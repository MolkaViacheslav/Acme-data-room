import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorStateProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
}

export function ErrorState({ title, message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-destructive size-5 shrink-0" aria-hidden />
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
        </div>
      </CardHeader>

      {onRetry !== undefined && (
        <CardContent>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Try again'}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
