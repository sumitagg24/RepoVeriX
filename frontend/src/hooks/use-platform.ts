'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  billingService,
  oauthService,
  onboardingService,
  organizationService,
  dashboardService,
  authService,
  patchService,
  tokenService,
  websiteService,
  patchQualityService,
} from '@/services/api';
import { useAuth } from '@/context/auth-context';
import type {
  ApiToken,
  ApiTokenCreated,
  BillingOverview,
  CheckoutResult,
  DashboardSummary,
  Patch,
  PatchQuality,
  OAuthConnection,
  OAuthProviderName,
  OAuthProviders,
  OnboardingStatus,
  OrgMember,
  OrgRead,
  OrgRepo,
  PlanName,
  ProviderRepository,
  SecurityCenter,
  SecurityOverview,
  TeamDashboard,
  VerificationRun,
  Website,
  WebsiteAudit,
  WebsiteCreate,
} from '@/types/api';

// ------------------------------------------------------------------ dashboard

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardService.summary,
  });
}

// -------------------------------------------------------------------- billing

export function useBilling() {
  const { user } = useAuth();
  // Marketing pages show the same catalogue, but entitlements are per account:
  // never call the endpoint anonymously (it would only return 401).
  return useQuery<BillingOverview>({
    queryKey: ['billing'],
    queryFn: billingService.overview,
    enabled: Boolean(user),
  });
}

export function useStartCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: PlanName): Promise<CheckoutResult> => billingService.checkout(plan),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({ mutationFn: () => billingService.portal() });
}

// ----------------------------------------------------------------- onboarding

export function useOnboarding() {
  const { user } = useAuth();
  return useQuery<OnboardingStatus>({
    queryKey: ['onboarding'],
    queryFn: onboardingService.status,
    enabled: Boolean(user),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => onboardingService.complete(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}

// ---------------------------------------------------------------------- oauth

export function useOAuthProviders() {
  return useQuery<OAuthProviders>({
    queryKey: ['oauth', 'providers'],
    queryFn: oauthService.providers,
    // Provider availability is deployment configuration; it does not change
    // while a user is signed in.
    staleTime: Infinity,
  });
}

export function useOAuthConnections() {
  return useQuery<OAuthConnection[]>({
    queryKey: ['oauth', 'connections'],
    queryFn: oauthService.connections,
  });
}

export function useProviderRepositories(provider: OAuthProviderName | null) {
  return useQuery<ProviderRepository[]>({
    queryKey: ['oauth', provider, 'repositories'],
    queryFn: () => oauthService.repositories(provider as OAuthProviderName),
    enabled: Boolean(provider),
    retry: false,
  });
}

export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: OAuthProviderName) => oauthService.disconnect(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['oauth', 'connections'] });
    },
  });
}

// ------------------------------------------------------------------- security

export function useSecurityOverview() {
  return useQuery<SecurityOverview>({
    queryKey: ['account', 'security'],
    queryFn: authService.securityOverview,
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeAllSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account', 'security'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      authService.changePassword(current, next),
  });
}

// ---------------------------------------------------------------- organizations

export function useOrganizations() {
  const { user } = useAuth();
  return useQuery<OrgRead[]>({
    queryKey: ['organizations'],
    queryFn: organizationService.list,
    enabled: Boolean(user),
  });
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery<OrgMember[]>({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => organizationService.members(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useOrganizationRepositories(orgId: string | undefined) {
  return useQuery<OrgRepo[]>({
    queryKey: ['organizations', orgId, 'repositories'],
    queryFn: () => organizationService.repositories(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useTeamDashboard(orgId: string | undefined) {
  return useQuery<TeamDashboard>({
    queryKey: ['organizations', orgId, 'dashboard'],
    queryFn: () => organizationService.dashboard(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useSecurityCenter(orgId: string | undefined) {
  return useQuery<SecurityCenter>({
    queryKey: ['organizations', orgId, 'security-center'],
    queryFn: () => organizationService.securityCenter(orgId as string),
    enabled: Boolean(orgId),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; slug?: string }) => organizationService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useAddMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'member' | 'admin' | 'owner' }) =>
      organizationService.addMember(orgId as string, email, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
    },
  });
}

export function useRemoveMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => organizationService.removeMember(orgId as string, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
    },
  });
}

export function useAttachRepository(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => organizationService.attachRepository(orgId as string, repositoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'repositories'] });
      void queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

export function useDetachRepository(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => organizationService.detachRepository(orgId as string, repositoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'repositories'] });
      void queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

// ------------------------------------------------------------------ patches

export function useVerifyPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patchId: string): Promise<VerificationRun> => patchService.verify(patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['findings'] });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function usePatches(params?: { status?: string; scan_id?: string; finding_id?: string }) {
  return useQuery<Patch[]>({
    queryKey: ['patches', 'list', params ?? {}],
    queryFn: () => patchService.list(params),
  });
}

export function usePatchVerifications(patchId: string | undefined) {
  return useQuery({
    queryKey: ['patches', patchId, 'verifications'],
    queryFn: () => patchService.verifications(patchId as string),
    enabled: Boolean(patchId),
    refetchInterval: (query) => {
      const runs = query.state.data as { status: string }[] | undefined;
      return runs?.some((run) => run.status === 'running' || run.status === 'pending') ? 2500 : false;
    },
  });
}
