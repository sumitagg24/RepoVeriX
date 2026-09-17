'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, AlertCircle } from 'lucide-react';
import { authService } from '@/services/api';
import { getApiErrorMessage as extractApiError } from '@/lib/api-error';
import { AuthShell } from '@/components/auth-shell';
import { toast } from 'sonner';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters — longer is better'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type Form = z.infer<typeof schema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const missingLink = !uid || !token;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setSubmitError(null);
    setIsLoading(true);
    try {
      await authService.resetPassword(uid, token, data.password);
      toast.success('Password updated. Please sign in.');
      router.push('/auth/login');
    } catch (error: unknown) {
      // Safe copy from the backend: invalid/expired link or weak password.
      setSubmitError(extractApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  if (missingLink) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <p className="font-medium">This link won&apos;t work</p>
        <p className="text-sm text-muted-foreground">
          This reset link is incomplete. Request a new one — links expire after 60 minutes and can
          be used only once.
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="A long, unique passphrase"
            autoComplete="new-password"
            className="pl-9"
            {...register('password')}
            disabled={isLoading}
          />
        </div>
        {errors.password && (
          <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" placeholder="Repeat it" autoComplete="new-password" {...register('confirm')} disabled={isLoading} />
        {errors.confirm && (
          <p className="text-xs font-medium text-destructive">{errors.confirm.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full shadow-sm" disabled={isLoading}>
        {isLoading ? 'Updating…' : 'Set new password'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Setting a new password signs out every other session.
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Links expire after 60 minutes and work once"
      footer={
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={null}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
