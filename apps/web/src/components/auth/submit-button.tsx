import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SubmitButtonProps {
  readonly pending: boolean;
  readonly pendingLabel: string;
  readonly children: React.ReactNode;
}

export function SubmitButton({ pending, pendingLabel, children }: SubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
