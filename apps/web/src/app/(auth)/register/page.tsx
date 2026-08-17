import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Create account — Data Room',
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create account"
      description="Your data room is set up automatically."
      footerPrompt="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/login"
    >
      <RegisterForm />
    </AuthCard>
  );
}
