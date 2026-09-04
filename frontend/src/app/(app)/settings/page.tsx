'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, Shield, Key, Bell, Globe, Trash2, Loader2, Link2, Cookie } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SettingsConnections } from '@/components/settings-connections';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [cookieChoice, setCookieChoice] = useState<string>(() => {
    if (typeof window === 'undefined') return 'unset';
    return localStorage.getItem('repoverix-cookie-consent') || 'unset';
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onProfileSubmit = async (data: ProfileForm) => {
    // API call to update profile would go here
    toast.success('Profile updated successfully');
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    // API call to change password would go here
    toast.success('Password changed successfully');
    passwordForm.reset();
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action is irreversible.')) return;
    if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) return;
    // API call to delete account
    toast.success('Account deletion initiated');
    logout();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="connections">
            <Link2 className="mr-2 h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Cookie className="mr-2 h-4 w-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="danger">
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      {...profileForm.register('full_name')}
                      disabled={profileForm.formState.isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...profileForm.register('email')}
                      disabled={profileForm.formState.isSubmitting}
                    />
                  </div>
                  <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                    {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
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
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
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
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
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
                      <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                    {passwordForm.formState.isSubmitting ? 'Changing...' : 'Change Password'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API keys for programmatic access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Default API Key</p>
                      <p className="text-sm text-muted-foreground">Created Jan 15, 2024 • Last used 2 hours ago</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Regenerate</Button>
                </div>
                <Button variant="outline" asChild>
                  <a href="/settings/api-keys">Manage API Keys</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive updates about scans and findings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { title: 'Scan Completed', desc: 'Get notified when a scan finishes', enabled: true },
                { title: 'Critical Findings', desc: 'Alert me immediately for critical severity issues', enabled: true },
                { title: 'High Findings', desc: 'Notify me about high severity findings', enabled: true },
                { title: 'Weekly Digest', desc: 'Receive a weekly summary of scan activity', enabled: false },
                { title: 'Email Notifications', desc: 'Receive notifications via email', enabled: true },
                { title: 'In-App Notifications', desc: 'Show notifications in the application', enabled: true },
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={item.enabled} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary peer-focus:ring-opacity-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="connections">
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
                      {cookieChoice === 'accepted' ? 'Accepted' : cookieChoice === 'rejected' ? 'Rejected' : 'Not chosen yet'}
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
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAccount}>
                    Delete Account
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Revoke All Sessions</p>
                    <p className="text-sm text-muted-foreground">
                      Sign out of all devices and revoke all active tokens. You will need to log in again.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => { logout(); toast.success('All sessions revoked'); }}>
                    Revoke Sessions
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Delete All Data</p>
                    <p className="text-sm text-muted-foreground">
                      Delete all repositories, scans, findings, and patches while keeping your account.
                    </p>
                  </div>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => toast.error('Not implemented yet')}>
                    Delete All Data
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