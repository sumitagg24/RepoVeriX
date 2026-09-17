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
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, User, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { OAuthSignInButton } from '@/components/oauth-buttons';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoMark } from '@/components/logo';
import { toast } from 'sonner';

const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
    fullName: z.string().min(1, 'Full name is required'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

function SignupPageInner() {
  const { signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', fullName: '' },
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      await signup(data.email, data.password, data.fullName);
      toast.success('Account created — welcome to RepoVeriX');
      // Landing-page pricing CTAs carry ?plan=pro|team → land users on the plan they picked.
      if (planParam && planParam !== 'free') {
        router.push(`/billing?plan=${encodeURIComponent(planParam)}`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* theme switch */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle variant="solid" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 w-fit">
            <LogoMark className="h-12 w-12 drop-shadow-sm" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Audit repositories with evidence — not guesses
          </p>
        </div>

        <div className="animate-rise rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-2.5">
            <OAuthSignInButton provider="google" next="/dashboard" />
            <div className="grid grid-cols-2 gap-2.5">
              <OAuthSignInButton provider="github" next="/dashboard" />
              <OAuthSignInButton provider="gitlab" next="/dashboard" />
            </div>
          </div>

          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or with email</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="fullName" placeholder="Ada Lovelace" className="pl-9" {...register('fullName')} disabled={isLoading} />
              </div>
              {errors.fullName && <p className="text-xs font-medium text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" className="pl-9" {...register('email')} disabled={isLoading} />
              </div>
              {errors.email && <p className="text-xs font-medium text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} disabled={isLoading} />
                {errors.password && <p className="text-xs font-medium text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} disabled={isLoading} />
                {errors.confirmPassword && <p className="text-xs font-medium text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 shadow-sm" disabled={isLoading}>
              {isLoading ? 'Creating account…' : (
                <>
                  <Check className="h-4 w-4" /> Create account
                </>
              )}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Need help?{' '}
              <Link href="/help" className="font-medium text-primary hover:underline">
                Visit the Help Center
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}
