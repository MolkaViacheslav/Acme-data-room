'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { FormField } from '@/components/auth/form-field';
import { SubmitButton } from '@/components/auth/submit-button';
import { register } from '@/lib/api/auth';
import { describeError } from '@/lib/api/client';
import type { AuthUser, RegisterRequest } from '@/lib/api/types';
import { safeNextPath } from '@/lib/auth/next-path';
import { SESSION_QUERY_KEY } from '@/lib/auth/use-session';
import {
  type FieldErrors,
  MIN_PASSWORD_LENGTH,
  hasErrors,
  validateRegisterForm,
} from '@/lib/auth/validation';

const EMPTY: RegisterRequest = { name: '', email: '', password: '' };

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Someone who followed a share link and chose to create an account must come
  // back to that link, not to their own empty drive.
  const next = safeNextPath(searchParams.get('next'));

  const [values, setValues] = useState<RegisterRequest>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<RegisterRequest>>({});

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      toast.success(`Your data room is ready, ${user.name}.`);
      router.replace(next);
    },
    onError: (error: unknown) => {
      toast.error(describeError(error));
    },
  });

  function update(field: keyof RegisterRequest, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateRegisterForm(values);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    mutation.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <FormField
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        value={values.name}
        error={errors.name}
        disabled={mutation.isPending}
        onChange={(event) => update('name', event.target.value)}
      />

      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={values.email}
        error={errors.email}
        disabled={mutation.isPending}
        onChange={(event) => update('email', event.target.value)}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        value={values.password}
        error={errors.password}
        disabled={mutation.isPending}
        onChange={(event) => update('password', event.target.value)}
      />

      <SubmitButton pending={mutation.isPending} pendingLabel="Creating your data room…">
        Create account
      </SubmitButton>
    </form>
  );
}
