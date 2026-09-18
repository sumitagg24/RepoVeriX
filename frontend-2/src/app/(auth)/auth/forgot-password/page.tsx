import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/auth/forms';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Reset your password',
  description: 'Request a single-use password reset link.',
  path: '/auth/forgot-password',
  index: false,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
