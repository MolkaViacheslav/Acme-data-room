'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { logout } from '@/lib/api/auth';
import { describeError } from '@/lib/api/client';

export function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Drop every cached query: the next user must not see the last one's data.
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error: unknown) => {
      toast.error(describeError(error));
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <LogOut className="size-4" />
      {mutation.isPending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
