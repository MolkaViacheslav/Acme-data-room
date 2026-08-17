'use client';

import { useMutation } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeError, suggestedNameFrom } from '@/lib/api/client';
import { createFolder } from '@/lib/api/folders';

interface NewFolderDialogProps {
  readonly parentId: string;
  readonly onCreated: () => void;
}

export function NewFolderDialog({ parentId, onCreated }: NewFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: (folderName: string) => createFolder({ name: folderName, parentId }),
    onSuccess: (folder) => {
      toast.success(`Created “${folder.name}”.`);
      setName('');
      setOpen(false);
      onCreated();
    },
    onError: (error: unknown) => {
      const suggestion = suggestedNameFrom(error);

      toast.error(
        suggestion === null
          ? describeError(error)
          : `${describeError(error)} Try “${suggestion}”.`,
      );
      if (suggestion !== null) setName(suggestion);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setName('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" />
          New folder
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (trimmed !== '') mutation.mutate(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>It will be created inside the current folder.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              autoFocus
              placeholder="Financials"
              disabled={mutation.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim() === '' || mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
