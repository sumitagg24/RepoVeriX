'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MailCheck } from 'lucide-react';
import { authService } from '@/services/api';
import { getApiErrorMessage as extractApiError } from '@/lib/api-error';
import { AuthShell } from '@/components/auth-shell';
import { toneHue } from '@/lib/tone';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setIsLoading(true);
    try {
      await authService.forgotPassword(data.email);
      // Always the same outcome from the user's point of view — the backend
      // intentionally does not reveal whether the address has an account.
      setSent(true);
    } catch (error: unknown) {
      toast.error(extractApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a one-time reset link"
      footer={
        <>
          Remembered it?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MailCheck className={`h-10 w-10 ${toneHue('verified')}`} aria-hidden />
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted-foreground">
            If an account exists for this email, you&apos;ll receive a message with the next
            steps shortly. The link expires in 60 minutes and can be used once.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="pl-9"
                {...register('email')}
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full shadow-sm" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
