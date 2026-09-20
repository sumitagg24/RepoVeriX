import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type {
  ArchiveImport,
  AttackPaths,
  BillingOverview,
  ChangeAuditResult,
  CheckoutResult,
  DashboardSummary,
  DedupReport,
  DependencyReachability,
  EvidenceGraph,
  FeedbackSummary,
  Finding,
  FindingDetail,
  FindingFeedback,
  FindingListParams,
  FindingSummary,
  GeneratedTest,
  GeneratedTestRun,
  ImpactAnalysis,
  OAuthConnection,
  OAuthImport,
  OAuthProviderName,
  OAuthProviders,
  OnboardingStatus,
  OrgMember,
  OrgRead,
  OrgRepo,
  Patch,
  ValidationVerdict,
  PlanName,
  ProofOfFix,
  ProviderRepository,
  RegressionReport,
  Repository,
  ReportShare,
  RepositoryCreate,
  RepositoryIntelligence,
  Scan,
  ScanCreate,
  ScanDetail,
  SecurityCenter,
  SecurityOverview,
  TeamDashboard,
  TokenResponse,
  User,
  VerificationRun,
  VerificationRunDetail,
} from '@/types/api';

/**
 * API access layer.
 *
 * The browser talks to `/api/v1` on **this** origin; Next.js proxies it to the
 * FastAPI backend (see `next.config.mjs`). That keeps every request same-origin
 * so the existing backend needs no CORS change. Setting `NEXT_PUBLIC_API_URL`
 * switches to direct cross-origin calls for deployments that prefer it.
 */
const DIRECT_API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const API_PREFIX = '/api/v1';
export const API_BASE = DIRECT_API_URL ? `${DIRECT_API_URL}${API_PREFIX}` : API_PREFIX;

/** Absolute backend origin — used only for full-page redirects (OAuth). */
export const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  DIRECT_API_URL ||
  'http://localhost:8000'
).replace(/\/$/, '');

/**
 * The backend serializes datetime columns as naive UTC strings (no offset).
 * `new Date('2026-09-18T10:00:00')` would be read as browser-local time, which
 * skews every relative timestamp, so stamp a `Z` onto `*_at` fields.
 */
export function normalizeNaiveUtcDates<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeNaiveUtcDates(item)) as unknown as T;
  }
  if (data !== null && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (
        typeof value === 'string' &&
        /_at$/.test(key) &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
      ) {
        result[key] = `${value}Z`;
      } else if (value !== null && typeof value === 'object') {
        result[key] = normalizeNaiveUtcDates(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }
  return data;
}

const ACCESS_TOKEN_KEY = 'repoverix.access_token';

export function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function persistToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* storage disabled — the in-memory token still works for this tab */
  }
}

/** Fired when the API answers 402 so any mounted surface can show an upsell. */
export const UPGRADE_EVENT = 'repoverix:upgrade';

/** Fired when the session is rejected so the shell can explain why. */
export const SESSION_EXPIRED_EVENT = 'repoverix:session-expired';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.defaults.transformResponse = [
  ...(Array.isArray(axios.defaults.transformResponse) ? axios.defaults.transformResponse : []),
  normalizeNaiveUtcDates,
];

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!config.headers.Authorization) {
      const token = accessToken ?? readStoredToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (typeof window !== 'undefined') {
      if (status === 401) {
        setAccessToken(null);
        persistToken(null);
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
      if (status === 402) {
        window.dispatchEvent(
          new CustomEvent(UPGRADE_EVENT, {
            detail: {
              reason: (error.response?.headers?.['x-upgrade-reason'] as string) || 'plan-limit',
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------------------- errors

export type ApiFailureKind =
  | 'unauthorized'
  | 'forbidden'
  | 'upgrade'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'rate-limited'
  | 'server'
  | 'network'
  | 'unknown';

export interface ApiFailure {
  kind: ApiFailureKind;
  status: number | null;
  message: string;
  /** Raw backend `detail` when it is a string (safe to show verbatim). */
  detail: string | null;
}

/**
 * Turn an axios rejection into something a screen can render without knowing
 * about HTTP. Backend `detail` strings are user-facing copy by design and are
 * preserved; anything else becomes a calm, generic sentence.
 */
export function toApiFailure(error: unknown): ApiFailure {
  if (!axios.isAxiosError(error)) {
    return {
      kind: 'unknown',
      status: null,
      message: 'Something went wrong. Please try again.',
      detail: null,
    };
  }
  const status = error.response?.status ?? null;
  const raw = error.response?.data;
  const detail =
    raw && typeof raw === 'object' && typeof (raw as { detail?: unknown }).detail === 'string'
      ? ((raw as { detail: string }).detail as string)
      : null;

  if (!status) {
    return {
      kind: 'network',
      status: null,
      message:
        'Cannot reach the RepoVeriX API. Check that the backend is running and try again.',
      detail: null,
    };
  }

  const kind: ApiFailureKind =
    status === 401
      ? 'unauthorized'
      : status === 402
        ? 'upgrade'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not-found'
            : status === 409
              ? 'conflict'
              : status === 422
                ? 'validation'
                : status === 429
                  ? 'rate-limited'
                  : status >= 500
                    ? 'server'
                    : 'unknown';

  const fallback: Record<ApiFailureKind, string> = {
    unauthorized: 'Your session has expired. Sign in again to continue.',
    forbidden: 'Your account does not have permission to do that.',
    upgrade: detail || 'This action is not available on your current plan.',
    'not-found': 'That item no longer exists or you do not have access to it.',
    conflict: detail || 'That action conflicts with the current state. Refresh and try again.',
    validation: detail || 'Some of those values were rejected. Check the form and try again.',
    'rate-limited': 'Too many requests. Wait a moment and try again.',
    server: 'The RepoVeriX service hit an error. Your data is safe — retry in a moment.',
    network: 'Cannot reach the RepoVeriX API.',
    unknown: 'Something went wrong. Please try again.',
  };

  return { kind, status, message: detail || fallback[kind], detail };
}

// -------------------------------------------------------------------- auth

export const authService = {
  signup: async (data: { email: string; password: string; full_name: string }) =>
    (await api.post<TokenResponse>('/auth/signup', data)).data,

  login: async (data: { email: string; password: string }) =>
    (await api.post<TokenResponse>('/auth/login', data)).data,

  me: async (): Promise<User> => (await api.get<User>('/auth/me')).data,

  updateProfile: async (fullName: string) =>
    (await api.put<{ detail: string; full_name: string }>('/auth/me', { full_name: fullName })).data,

  deleteAccount: async () => {
    await api.delete('/auth/me');
  },

  forgotPassword: async (email: string) =>
    (await api.post<{ detail: string }>('/auth/forgot-password', { email })).data,

  resetPassword: async (uid: string, token: string, newPassword: string) =>
    (await api.post<{ detail: string }>('/auth/reset-password', {
      uid,
      token,
      new_password: newPassword,
    })).data,

  verifyEmail: async (uid: string, token: string) =>
    (await api.post<{ detail: string }>('/auth/verify-email', { uid, token })).data,

  resendVerification: async (email: string) =>
    (await api.post<{ detail: string; dev_verification_url?: string | null }>(
      '/auth/resend-verification',
      { email }
    )).data,

  changePassword: async (currentPassword: string, newPassword: string) =>
    (await api.post<{ detail: string; access_token: string }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })).data,

  securityOverview: async (): Promise<SecurityOverview> =>
    (await api.get<SecurityOverview>('/auth/security-overview')).data,

  revokeAllSessions: async () =>
    (await api.post<{ detail: string; access_token: string }>('/auth/revoke-all-sessions')).data,

  logout: async () => {
    await api.post('/auth/logout');
  },
};

export const oauthService = {
  providers: async (): Promise<OAuthProviders> =>
    (await api.get<OAuthProviders>('/auth/oauth/providers')).data,

  connections: async (): Promise<OAuthConnection[]> =>
    (await api.get<OAuthConnection[]>('/auth/oauth/connections')).data,

  repositories: async (provider: OAuthProviderName): Promise<ProviderRepository[]> =>
    (await api.get<{ repositories: ProviderRepository[] }>(`/auth/oauth/${provider}/repos`)).data
      .repositories,

  disconnect: async (provider: OAuthProviderName) => {
    await api.delete(`/auth/oauth/${provider}`);
  },

  /**
   * Full-page browser navigation to the provider consent screen. It must hit
   * the backend origin directly: the backend stores the OAuth `state` in a
   * cookie scoped to that origin, and the provider redirects back to the
   * backend callback before returning the session to the app.
   */
  loginUrl: (provider: OAuthProviderName, next = '/dashboard') =>
    `${API_ORIGIN}${API_PREFIX}/auth/oauth/${provider}/login?next=${encodeURIComponent(next)}`,
};

// ------------------------------------------------------------ repositories

export const repositoryService = {
  list: async (): Promise<Repository[]> => (await api.get<Repository[]>('/repositories')).data,

  get: async (id: string): Promise<Repository> =>
    (await api.get<Repository>(`/repositories/${id}`)).data,

  create: async (data: RepositoryCreate): Promise<Repository> =>
    (await api.post<Repository>('/repositories', data)).data,

  createFromZip: async (name: string, file: File): Promise<Repository> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    const { data } = await api.post<Repository>('/repositories/zip', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  createFromArchive: async (data: ArchiveImport): Promise<Repository> =>
    (await api.post<Repository>('/repositories/archive', data)).data,

  createFromOAuth: async (data: OAuthImport): Promise<Repository> =>
    (await api.post<Repository>('/repositories/oauth', data)).data,

  remove: async (id: string) => {
    await api.delete(`/repositories/${id}`);
  },

  intelligence: async (id: string, refresh = false): Promise<RepositoryIntelligence> =>
    (await api.get<RepositoryIntelligence>(
      `/repositories/${id}/intelligence${refresh ? '?refresh=1' : ''}`
    )).data,

  attackPaths: async (id: string): Promise<AttackPaths> =>
    (await api.get<AttackPaths>(`/repositories/${id}/attack-paths`)).data,

  dependencyReachability: async (id: string): Promise<DependencyReachability> =>
    (await api.get<DependencyReachability>(`/repositories/${id}/dependency-reachability`)).data,

  evidenceGraph: async (id: string): Promise<EvidenceGraph> =>
    (await api.get<EvidenceGraph>(`/repositories/${id}/evidence-graph`)).data,

  regression: async (id: string, params?: { from?: string; to?: string }): Promise<RegressionReport> =>
    (await api.get<RegressionReport>(`/repositories/${id}/regression`, { params })).data,

  changeAudit: async (
    id: string,
    payload: { base?: string; head?: string; diff?: string; commit?: string }
  ): Promise<ChangeAuditResult> =>
    (await api.post<ChangeAuditResult>(`/repositories/${id}/change-audit`, payload)).data,
};

// -------------------------------------------------------------------- scans

export const scanService = {
  list: async (repositoryId?: string): Promise<Scan[]> =>
    (await api.get<Scan[]>('/scans', { params: repositoryId ? { repository_id: repositoryId } : {} }))
      .data,

  get: async (id: string): Promise<ScanDetail> => (await api.get<ScanDetail>(`/scans/${id}`)).data,

  create: async (data: ScanCreate, idempotencyKey?: string): Promise<Scan> =>
    (await api.post<Scan>('/scans', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })).data,

  cancel: async (id: string): Promise<Scan> => (await api.post<Scan>(`/scans/${id}/cancel`)).data,

  findings: async (
    id: string,
    params?: { severity?: string; status?: string; limit?: number; offset?: number }
  ): Promise<Finding[]> => (await api.get<Finding[]>(`/scans/${id}/findings`, { params })).data,

  summary: async (id: string): Promise<FindingSummary> =>
    (await api.get<FindingSummary>(`/findings/scan/${id}/summary`)).data,

  dedup: async (id: string): Promise<DedupReport> =>
    (await api.get<DedupReport>(`/scans/${id}/dedup`)).data,

  /** Markdown report download (browser navigation; the endpoint sets headers). */
  reportUrl: (id: string, format: 'json' | 'markdown' = 'markdown') =>
    `${API_BASE}/scans/${id}/report?format=${format}`,

  /** SARIF 2.1.0 export (browser navigation). */
  sarifUrl: (id: string) => `${API_BASE}/scans/${id}/sarif`,

  createShare: async (id: string, expiryDays?: number): Promise<ReportShare> =>
    (await api.post<ReportShare>(`/scans/${id}/share`, expiryDays ? { expiry_days: expiryDays } : {}))
      .data,

  listShares: async (id: string): Promise<ReportShare[]> =>
    (await api.get<ReportShare[]>(`/scans/${id}/share`)).data,

  revokeShare: async (shareId: string) => {
    await api.delete(`/shares/${shareId}`);
  },
};

// ----------------------------------------------------------------- findings

export const findingService = {
  list: async (params?: FindingListParams): Promise<Finding[]> =>
    (await api.get<Finding[]>('/findings', { params })).data,

  get: async (id: string): Promise<FindingDetail> =>
    (await api.get<FindingDetail>(`/findings/${id}`)).data,

  impact: async (id: string): Promise<ImpactAnalysis> =>
    (await api.get<ImpactAnalysis>(`/findings/${id}/impact`)).data,

  proofOfFix: async (id: string): Promise<ProofOfFix> =>
    (await api.get<ProofOfFix>(`/findings/${id}/proof-of-fix`)).data,

  generateFix: async (id: string): Promise<Patch> =>
    (await api.post<Patch>(`/findings/${id}/generate-fix`)).data,

  generateTest: async (id: string): Promise<GeneratedTest> =>
    (await api.post<GeneratedTest>(`/findings/${id}/generate-test`)).data,

  runTest: async (testId: string, patchId?: string) =>
    (
      await api.post<GeneratedTestRun>(
        `/findings/generated-tests/${testId}/run`,
        patchId ? { patch_id: patchId } : {}
      )
    ).data,

  validate: async (id: string): Promise<ValidationVerdict> =>
    (await api.post<ValidationVerdict>(`/findings/${id}/validate`)).data,

  submitFeedback: async (
    id: string,
    verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful',
    note?: string
  ): Promise<FindingFeedback> =>
    (await api.post<FindingFeedback>(`/findings/${id}/feedback`, { verdict, note: note || null }))
      .data,

  myFeedback: async (id: string): Promise<FindingFeedback | null> =>
    (await api.get<FindingFeedback | null>(`/findings/${id}/feedback`)).data,

  feedbackSummary: async (id: string): Promise<FeedbackSummary> =>
    (await api.get<FeedbackSummary>(`/findings/${id}/feedback/summary`)).data,

  deleteFeedback: async (id: string) => {
    await api.delete(`/findings/${id}/feedback`);
  },
};

// ------------------------------------------------------------------ patches

export const patchService = {
  list: async (params?: { finding_id?: string; scan_id?: string; status?: string }): Promise<Patch[]> =>
    (await api.get<Patch[]>('/patches', { params })).data,

  get: async (id: string): Promise<Patch> => (await api.get<Patch>(`/patches/${id}`)).data,

  verify: async (id: string): Promise<VerificationRun> =>
    (await api.post<VerificationRun>(`/patches/${id}/verify`)).data,

  verifications: async (id: string): Promise<VerificationRun[]> =>
    (await api.get<VerificationRun[]>(`/patches/${id}/verifications`)).data,

  verification: async (id: string): Promise<VerificationRunDetail> =>
    (await api.get<VerificationRunDetail>(`/patches/verification/${id}`)).data,
};

// ---------------------------------------------------------------- dashboard

export const dashboardService = {
  summary: async (): Promise<DashboardSummary> =>
    (await api.get<DashboardSummary>('/dashboard/summary')).data,
};

// ------------------------------------------------------------------ billing

export const billingService = {
  overview: async (): Promise<BillingOverview> => (await api.get<BillingOverview>('/billing')).data,

  checkout: async (plan: PlanName): Promise<CheckoutResult> =>
    (await api.post<CheckoutResult>(`/billing/checkout?plan=${plan}`)).data,

  portal: async (): Promise<{ url: string }> => (await api.post<{ url: string }>('/billing/portal')).data,
};

// -------------------------------------------------------------- teams / orgs

export const organizationService = {
  list: async (): Promise<OrgRead[]> => (await api.get<OrgRead[]>('/organizations')).data,

  create: async (payload: { name: string; slug?: string }): Promise<OrgRead> =>
    (await api.post<OrgRead>('/organizations', payload)).data,

  members: async (orgId: string): Promise<OrgMember[]> =>
    (await api.get<OrgMember[]>(`/organizations/${orgId}/members`)).data,

  addMember: async (orgId: string, email: string, role: 'member' | 'admin' | 'owner') =>
    (await api.post<OrgMember>(`/organizations/${orgId}/members`, { email, role })).data,

  removeMember: async (orgId: string, memberId: string) => {
    await api.delete(`/organizations/${orgId}/members/${memberId}`);
  },

  repositories: async (orgId: string): Promise<OrgRepo[]> =>
    (await api.get<OrgRepo[]>(`/organizations/${orgId}/repositories`)).data,

  attachRepository: async (orgId: string, repositoryId: string) => {
    await api.post(`/organizations/${orgId}/repositories`, { repository_id: repositoryId });
  },

  detachRepository: async (orgId: string, repositoryId: string) => {
    await api.delete(`/organizations/${orgId}/repositories/${repositoryId}`);
  },

  dashboard: async (orgId: string): Promise<TeamDashboard> =>
    (await api.get<TeamDashboard>(`/organizations/${orgId}/dashboard`)).data,

  securityCenter: async (orgId: string): Promise<SecurityCenter> =>
    (await api.get<SecurityCenter>(`/organizations/${orgId}/security-center`)).data,
};

// ---------------------------------------------------------------- onboarding

export const onboardingService = {
  status: async (): Promise<OnboardingStatus> =>
    (await api.get<OnboardingStatus>('/onboarding/status')).data,

  complete: async (): Promise<{ completed: boolean; completed_at?: string | null }> =>
    (await api.post<{ completed: boolean; completed_at?: string | null }>('/onboarding/complete'))
      .data,
};

/**
 * Download an authenticated artifact (Markdown report, SARIF export).
 *
 * These endpoints require the bearer token, and a plain anchor cannot carry one,
 * so the bytes are fetched through the intercepting client and handed to the
 * browser as a blob. No backend change is needed for either format.
 */
export async function downloadArtifact(url: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so Safari has started the download.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

export default api;
