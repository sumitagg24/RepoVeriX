'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toneHue } from '@/lib/tone';
import {
  User,
  Shield,
  Trash2,
  Loader2,
  Link2,
  Cookie,
  CheckCircle2,
  XCircle,
  History,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SettingsConnections } from '@/components/settings-connections';
import { PageHeader } from '@/components/system/page-header';
import { authService } from '@/services/api';
import type { SecurityOverview } from '@/types/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Use at least 8 characters — longer is better'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

/** Human-readable labels for the audit event catalogue. */
const EVENT_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: 'Signed in',
  AUTH_LOGIN_FAILURE: 'Failed sign-in attempt',
  AUTH_PASSWORD_CHANGED: 'Password changed',
  AUTH_PASSWORD_RESET: 'Password reset via email',
  AUTH_EMAIL_VERIFIED: 'Email verified',
  AUTH_ACCOUNT_LOCKED: 'Temporary lockout triggered',
  AUTH_SESSION_REVOKED: 'Sessions revoked',
  AUTH_PROVIDER_CONNECTED: 'Provider connected',
  AUTH_PROVIDER_DISCONNECTED: 'Provider disconnected',
  AUTH_SIGNUP: 'Account created',
  AUTH_LOGOUT: 'Signed out',
};

export default function SettingsPage() {
  const { user, logout, logoutWithAudit, rotateToken, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [security, setSecurity] = useState<SecurityOverview | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cookieChoice, setCookieChoice] = useState<string>(() => {
    if (typeof window === 'undefined') return 'unset';
    return localStorage.getItem('repoverix-cookie-consent') || 'unset';
  });

  const loadSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      setSecurity(await authService.securityOverview());
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'security' && !security && !securityLoading) {
      loadSecurity();
    }
  }, [activeTab, security, securityLoading, loadSecurity]);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name || '' },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      await authService.updateProfile(data.full_name);
      await refreshUser();
      toast.success('Profile updated');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      const result = await authService.changePassword(data.currentPassword, data.newPassword);
      await rotateToken(result.access_token);
      passwordForm.reset();
      setSecurity(null); // re-fetch with fresh token next visit
      toast.success('Password changed. Other sessions were signed out.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      const result = await authService.revokeAllSessions();
      await rotateToken(result.access_token);
      setSecurity(null);
      toast.success('All other sessions were signed out. This device stays signed in.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setRevoking(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'This permanently deletes your account, repositories, scans and findings. This cannot be undone. Continue?'
      )
    )
      return;
    if (!confirm('Final confirmation: delete everything?')) return;
    setDeleting(true);
    try {
      await authService.deleteAccount();
      logout();
      toast.success('Account deleted.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Identity, security, provider access, privacy and danger zone."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="gap-1.5 px-2">
            <User className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 px-2">
            <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5 px-2">
            <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Connections</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-1.5 px-2">
            <Cookie className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-1.5 px-2">
            <Trash2 className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <span className="hidden sm:inline">Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your display name</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    {...profileForm.register('full_name')}
                    disabled={profileForm.formState.isSubmitting}
                  />
                  {profileForm.formState.errors.full_name && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.full_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">
                    Your email is your verified sign-in identity and cannot be changed here.
                  </p>
                </div>
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account security</CardTitle>
              <CardDescription>Verification, status and recent activity</CardDescription>
            </CardHeader>
            <CardContent>
              {securityLoading && !security ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading security overview…
                </div>
              ) : security ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      {security.email_verified ? (
                        <CheckCircle2 className={`h-4 w-4 ${toneHue('verified')}`} />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      Email {security.email_verified ? 'verified' : 'not verified'}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="capitalize">
                        {security.account_status}
                      </Badge>
                      account status
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Multi-factor: {security.mfa_status === 'not_available_yet' ? 'not available yet' : security.mfa_status}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <History className="h-4 w-4" /> Recent security activity
                    </p>
                    {security.recent_events.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No recorded events yet.</p>
                    ) : (
                      <ul className="mt-3 divide-y divide-border/60 rounded-lg border">
                        {security.recent_events.map((e, i) => (
                          <li key={i} className="data-row flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <span>{EVENT_LABELS[e.event] ?? e.event}</span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              {e.ip ? `${e.ip} · ` : ''}
                              {e.at ? new Date(e.at).toLocaleString() : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Events store time and IP metadata only — never credentials. See{' '}
                      <Link href="/docs/account-security" className="underline hover:text-foreground">
                        account security
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Security overview unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Changing your password signs out every other session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...passwordForm.register('currentPassword')}
                    disabled={passwordForm.formState.isSubmitting}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...passwordForm.register('newPassword')}
                    disabled={passwordForm.formState.isSubmitting}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...passwordForm.register('confirmPassword')}
                    disabled={passwordForm.formState.isSubmitting}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Signing in</span> answers “who are
              you?”. <span className="font-semibold text-foreground">Connecting a provider</span>{' '}
              answers “what external resources may RepoVeriX access on your behalf?” — repository
              contents for imports, never your credentials. Revoking removes access immediately;
              already-imported data stays until you delete the repository.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Connected accounts</CardTitle>
              <CardDescription>
                Google for one-click sign-in; GitHub and GitLab for private repository imports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsConnections />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="h-5 w-5" />
                Cookies & consent
              </CardTitle>
              <CardDescription>
                Essential cookies keep you signed in and secure. Non-essential analytics cookies
                are only loaded with your explicit consent — change your choice below any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Analytics cookies</p>
                  <p className="text-sm text-muted-foreground">
                    Current choice:{' '}
                    <span className="font-medium capitalize">
                      {cookieChoice === 'accepted'
                        ? 'Accepted'
                        : cookieChoice === 'rejected'
                          ? 'Rejected'
                          : 'Not chosen yet'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={cookieChoice === 'accepted' ? 'default' : 'outline'}
                    onClick={() => {
                      localStorage.setItem('repoverix-cookie-consent', 'accepted');
                      setCookieChoice('accepted');
                      toast.success('Analytics cookies enabled');
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant={cookieChoice === 'rejected' ? 'default' : 'outline'}
                    onClick={() => {
                      localStorage.setItem('repoverix-cookie-consent', 'rejected');
                      setCookieChoice('rejected');
                      toast.success('Analytics cookies disabled');
                    }}
                  >
                    Reject
                  </Button>
                  {cookieChoice !== 'unset' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        localStorage.removeItem('repoverix-cookie-consent');
                        setCookieChoice('unset');
                        toast.success('Choice cleared — the banner will show again');
                      }}
                    >
                      Clear choice
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                See our{' '}
                <Link href="/privacy" className="font-medium text-primary hover:underline">
                  privacy policy
                </Link>{' '}
                for details on what we store and why.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions. Proceed with caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Revoke All Sessions</p>
                    <p className="text-sm text-muted-foreground">
                      Sign out of all other devices by invalidating every existing token. This
                      device stays signed in.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleRevokeAll} disabled={revoking}>
                    {revoking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Revoking…
                      </>
                    ) : (
                      'Revoke Sessions'
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data. This action cannot
                      be undone.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                      </>
                    ) : (
                      'Delete Account'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
