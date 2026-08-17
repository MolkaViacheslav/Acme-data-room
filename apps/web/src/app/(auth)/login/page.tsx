import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in — Data Room',
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Access your data room."
      footerPrompt="No account yet?"
      footerLinkLabel="Create one"
      footerHref="/register"
    >
      <LoginForm />
    </AuthCard>
  );
}
