import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  OnboardingStatus,
  ProofOfFix,
  RunTestResponse,
  User,
  TokenResponse,
  SecurityOverview,
  LoginRequest,
  SignupRequest,
  Repository,
  RepositoryCreate,
  ArchiveImport,
  OAuthImport,
  OAuthProviders,
  ProviderRepository,
  Scan,
  ScanCreate,
  ScanDetail,
  Finding,
  FindingDetail,
  Patch,
  VerificationRun,
  VerificationRunDetail,
  DashboardSummary,
  FindingSummary,
  BillingOverview,
  CheckoutResult,
  RepositoryIntelligence,
  WikiProseResult,
  ChangeAuditResult,
  EvidenceGraph,
  AttackPaths,
  DependencyReachability,
  RegressionReport,
  DedupReport,
  GeneratedTest,
  CounterexampleResult,
  RepositoryQueryResult,
  ArchitectureSmellsResult,
  HealthTimeline,
  ImpactAnalysis,
  FindingChatResult,
  ChangeExplanation,
  PatchQuality,
  MultiAgentResult,
  SelfImprovementResult,
  VulnMiningResult,
  RiskModelResult,
  LearningPatternsResult,
  PullRequestAuditSummary,
  PullRequestAuditDetail,
  ChangeAuditMeta,
  FindingValidationResult,
  ReportShare,
  FindingFeedback,
  FeedbackSummary,
  OrgRead,
  OrgMember,
  OrgRepo,
  TeamDashboard,
  SecurityCenter,
  Website,
  WebsiteAudit,
  WebsiteAuditDetail
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

/**
 * The backend serializes datetime columns as naive UTC strings (no timezone
 * suffix). JavaScript's Date constructor interprets such strings as browser-
 * local time, which skews every relative timestamp ("6 hours ago" for a scan
 * created seconds earlier). Recursively append 'Z' to *_at fields so they are
 * parsed as UTC.
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

const api = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

api.defaults.transformResponse = [
  ...(Array.isArray(axios.defaults.transformResponse)
    ? axios.defaults.transformResponse
    : []),
  normalizeNaiveUtcDates,
];

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setAccessToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
        window.location.href = '/auth/login';
      }
    }
    if (error.response?.status === 402 && typeof window !== 'undefined') {
      // Let any mountable component surface an upsell without breaking the caller.
      window.dispatchEvent(
        new CustomEvent('repoverix:upgrade', {
          detail: { reason: (error.response?.headers?.['x-upgrade-reason'] as string) || 'limit' },
        })
      );
    }
    return Promise.reject(error);
  }
);

export const authService = {
  signup: async (data: SignupRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/signup', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login', data);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ detail: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (uid: string, token: string, newPassword: string): Promise<{ detail: string }> => {
    const response = await api.post('/auth/reset-password', {
      uid,
      token,
      new_password: newPassword,
    });
    return response.data;
  },

  verifyEmail: async (uid: string, token: string): Promise<{ detail: string }> => {
    const response = await api.post('/auth/verify-email', { uid, token });
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ detail: string; dev_verification_url?: string | null }> => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ detail: string; access_token: string }> => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  securityOverview: async (): Promise<SecurityOverview> => {
    const response = await api.get<SecurityOverview>('/auth/security-overview');
    return response.data;
  },

  revokeAllSessions: async (): Promise<{ detail: string; access_token: string }> => {
    const response = await api.post('/auth/revoke-all-sessions');
    return response.data;
  },

  logoutAudit: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  updateProfile: async (fullName: string): Promise<{ detail: string; full_name: string }> => {
    const response = await api.put('/auth/me', { full_name: fullName });
    return response.data;
  },

  deleteAccount: async (): Promise<void> => {
    await api.delete('/auth/me');
  },

  me: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  oauthProviders: async (): Promise<OAuthProviders> => {
    const response = await api.get<OAuthProviders>('/auth/oauth/providers');
    return response.data;
  },

  oauthRepos: async (provider: string): Promise<ProviderRepository[]> => {
    const response = await api.get<{ provider: string; repositories: ProviderRepository[] }>(
      `/auth/oauth/${provider}/repos`
    );
    return response.data.repositories;
  },

  oauthDisconnect: async (provider: string): Promise<void> => {
    await api.delete(`/auth/oauth/${provider}`);
  },

  oauthConnections: async (): Promise<
    { provider: string; provider_email: string | null; provider_name: string | null; connected_at: string }[]
  > => {
    const response = await api.get('/auth/oauth/connections');
    return response.data;
  },

  oauthLoginUrl: (provider: string, next = '/dashboard'): string =>
    `${API_URL}${API_PREFIX}/auth/oauth/${provider}/login?next=${encodeURIComponent(next)}`,
};

export const repositoryService = {
  list: async (): Promise<Repository[]> => {
    const response = await api.get<Repository[]>('/repositories');
    return response.data;
  },

  create: async (data: RepositoryCreate): Promise<Repository> => {
    const response = await api.post<Repository>('/repositories', data);
    return response.data;
  },

  get: async (id: string): Promise<Repository> => {
    const response = await api.get<Repository>(`/repositories/${id}`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/repositories/${id}`);
  },

  createFromZip: async (name: string, file: File): Promise<Repository> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    const response = await api.post<Repository>('/repositories/zip', formData);
    return response.data;
  },

  createFromArchive: async (data: ArchiveImport): Promise<Repository> => {
    const response = await api.post<Repository>('/repositories/archive', data);
    return response.data;
  },

  createFromOAuth: async (data: OAuthImport): Promise<Repository> => {
    const response = await api.post<Repository>('/repositories/oauth', data);
    return response.data;
  },
};

export const auditService = {
  changeAudit: async (
    repositoryId: string,
    payload: { base?: string; head?: string; diff?: string; commit?: string }
  ): Promise<ChangeAuditResult> => {
    const response = await api.post<ChangeAuditResult>(
      `/repositories/${repositoryId}/change-audit`,
      payload
    );
    return response.data;
  },

  changeAudits: async (repositoryId: string): Promise<ChangeAuditMeta[]> => {
    const response = await api.get<ChangeAuditMeta[]>(
      `/repositories/${repositoryId}/change-audits`
    );
    return response.data;
  },

  evidenceGraph: async (repositoryId: string): Promise<EvidenceGraph> => {
    const response = await api.get<EvidenceGraph>(
      `/repositories/${repositoryId}/evidence-graph`
    );
    return response.data;
  },

  attackPaths: async (repositoryId: string): Promise<AttackPaths> => {
    const response = await api.get<AttackPaths>(
      `/repositories/${repositoryId}/attack-paths`
    );
    return response.data;
  },

  dependencyReachability: async (repositoryId: string): Promise<DependencyReachability> => {
    const response = await api.get<DependencyReachability>(
      `/repositories/${repositoryId}/dependency-reachability`
    );
    return response.data;
  },

  regression: async (
    repositoryId: string,
    params?: { from?: string; to?: string }
  ): Promise<RegressionReport> => {
    const response = await api.get<RegressionReport>(
      `/repositories/${repositoryId}/regression`,
      { params }
    );
    return response.data;
  },

  explainChange: async (
    repositoryId: string,
    payload: { base?: string; head?: string; diff?: string }
  ): Promise<ChangeExplanation> => {
    const response = await api.post<ChangeExplanation>(
      `/repositories/${repositoryId}/explain-change`,
      payload
    );
    return response.data;
  },
};

export const scanAuditService = {
  sarif: async (scanId: string): Promise<Record<string, unknown>> => {
    const response = await api.get<Record<string, unknown>>(`/scans/${scanId}/sarif`, {
      responseType: 'json',
    });
    return response.data;
  },

  dedup: async (scanId: string): Promise<DedupReport> => {
    const response = await api.get<DedupReport>(`/scans/${scanId}/dedup`);
    return response.data;
  },
};

export const findingAuditService = {
  generateTest: async (findingId: string): Promise<GeneratedTest> => {
    const response = await api.post<GeneratedTest>(
      `/findings/${findingId}/generate-test`
    );
    return response.data;
  },

  runTest: async (testId: string, patchId?: string): Promise<RunTestResponse> => {
    const response = await api.post<RunTestResponse>(
      `/findings/generated-tests/${testId}/run`,
      patchId ? { patch_id: patchId } : undefined
    );
    return response.data;
  },

  proofOfFix: async (findingId: string): Promise<ProofOfFix> => {
    const response = await api.get<ProofOfFix>(`/findings/${findingId}/proof-of-fix`);
    return response.data;
  },

  validateFinding: async (findingId: string): Promise<FindingValidationResult> => {
    const response = await api.post<FindingValidationResult>(
      `/findings/${findingId}/validate`
    );
    return response.data;
  },

  validateCounterexample: async (findingId: string): Promise<CounterexampleResult> => {
    const response = await api.post<CounterexampleResult>(
      `/findings/${findingId}/validate-counterexample`
    );
    return response.data;
  },

  impact: async (findingId: string): Promise<ImpactAnalysis> => {
    const response = await api.get<ImpactAnalysis>(`/findings/${findingId}/impact`);
    return response.data;
  },

  chat: async (
    findingId: string,
    question: string,
    useLlm = false
  ): Promise<FindingChatResult> => {
    const response = await api.post<FindingChatResult>(`/findings/${findingId}/chat`, {
      question,
      use_llm: useLlm,
    });
    return response.data;
  },
};

export const scanService = {
  list: async (repositoryId?: string): Promise<Scan[]> => {
    const params = repositoryId ? { repository_id: repositoryId } : {};
    const response = await api.get<Scan[]>('/scans', { params });
    return response.data;
  },

  create: async (data: ScanCreate): Promise<Scan> => {
    const response = await api.post<Scan>('/scans', data);
    return response.data;
  },

  get: async (id: string): Promise<ScanDetail> => {
    const response = await api.get<ScanDetail>(`/scans/${id}`);
    return response.data;
  },

  cancel: async (id: string): Promise<Scan> => {
    const response = await api.post<Scan>(`/scans/${id}/cancel`);
    return response.data;
  },

  createShare: async (id: string, expiryDays?: number): Promise<ReportShare> => {
    const response = await api.post<ReportShare>(
      `/scans/${id}/share`,
      expiryDays ? { expiry_days: expiryDays } : {}
    );
    return response.data;
  },

  listShares: async (id: string): Promise<ReportShare[]> => {
    const response = await api.get<ReportShare[]>(`/scans/${id}/share`);
    return response.data;
  },

  revokeShare: async (shareId: string): Promise<void> => {
    await api.delete(`/shares/${shareId}`);
  },
};

export const findingService = {
  list: async (params?: {
    scan_id?: string;
    repository_id?: string;
    category?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Finding[]> => {
    const response = await api.get<Finding[]>('/findings', { params });
    return response.data;
  },

  get: async (id: string): Promise<FindingDetail> => {
    const response = await api.get<FindingDetail>(`/findings/${id}`);
    return response.data;
  },

  getScanSummary: async (scanId: string): Promise<FindingSummary> => {
    const response = await api.get<FindingSummary>(`/findings/scan/${scanId}/summary`);
    return response.data;
  },

  generateFix: async (findingId: string): Promise<Patch> => {
    const response = await api.post<Patch>(`/findings/${findingId}/generate-fix`);
    return response.data;
  },

  submitFeedback: async (
    findingId: string,
    verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful',
    note?: string
  ): Promise<FindingFeedback> => {
    const response = await api.post<FindingFeedback>(`/findings/${findingId}/feedback`, {
      verdict,
      note: note || null,
    });
    return response.data;
  },

  getMyFeedback: async (findingId: string): Promise<FindingFeedback | null> => {
    const response = await api.get<FindingFeedback | null>(`/findings/${findingId}/feedback`);
    return response.data;
  },

  getFeedbackSummary: async (findingId: string): Promise<FeedbackSummary> => {
    const response = await api.get<FeedbackSummary>(`/findings/${findingId}/feedback/summary`);
    return response.data;
  },

  deleteFeedback: async (findingId: string): Promise<void> => {
    await api.delete(`/findings/${findingId}/feedback`);
  },
};

export const orgService = {
  listMy: async (): Promise<OrgRead[]> => {
    const response = await api.get<OrgRead[]>('/organizations');
    return response.data;
  },

  create: async (payload: { name: string; slug?: string }): Promise<OrgRead> => {
    const response = await api.post<OrgRead>('/organizations', payload);
    return response.data;
  },

  getDashboard: async (orgId: string): Promise<TeamDashboard> => {
    const response = await api.get<TeamDashboard>(`/organizations/${orgId}/dashboard`);
    return response.data;
  },

  getSecurityCenter: async (orgId: string): Promise<SecurityCenter> => {
    const response = await api.get<SecurityCenter>(`/organizations/${orgId}/security-center`);
    return response.data;
  },

  listMembers: async (orgId: string): Promise<OrgMember[]> => {
    const response = await api.get<OrgMember[]>(`/organizations/${orgId}/members`);
    return response.data;
  },

  addMember: async (orgId: string, email: string, role: 'member' | 'admin' | 'owner'): Promise<OrgMember> => {
    const response = await api.post<OrgMember>(`/organizations/${orgId}/members`, { email, role });
    return response.data;
  },

  removeMember: async (orgId: string, memberId: string): Promise<void> => {
    await api.delete(`/organizations/${orgId}/members/${memberId}`);
  },

  listOrgRepos: async (orgId: string): Promise<OrgRepo[]> => {
    const response = await api.get<OrgRepo[]>(`/organizations/${orgId}/repositories`);
    return response.data;
  },

  attachRepo: async (orgId: string, repositoryId: string): Promise<void> => {
    await api.post(`/organizations/${orgId}/repositories`, { repository_id: repositoryId });
  },

  detachRepo: async (orgId: string, repositoryId: string): Promise<void> => {
    await api.delete(`/organizations/${orgId}/repositories/${repositoryId}`);
  },
};

export const patchService = {
  list: async (params?: {
    finding_id?: string;
    scan_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Patch[]> => {
    const response = await api.get<Patch[]>('/patches', { params });
    return response.data;
  },

  get: async (id: string): Promise<Patch> => {
    const response = await api.get<Patch>(`/patches/${id}`);
    return response.data;
  },

  listVerifications: async (patchId: string): Promise<VerificationRun[]> => {
    const response = await api.get<VerificationRun[]>(`/patches/${patchId}/verifications`);
    return response.data;
  },

  getVerification: async (verificationId: string): Promise<VerificationRunDetail> => {
    const response = await api.get<VerificationRunDetail>(`/patches/verification/${verificationId}`);
    return response.data;
  },

  verify: async (patchId: string): Promise<VerificationRun> => {
    const response = await api.post<VerificationRun>(`/patches/${patchId}/verify`);
    return response.data;
  },

  quality: async (patchId: string): Promise<PatchQuality> => {
    const response = await api.get<PatchQuality>(`/patches/${patchId}/quality`);
    return response.data;
  },
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },
};

export const intelligenceService = {
  get: async (repositoryId: string, refresh = false): Promise<RepositoryIntelligence> => {
    const response = await api.get<RepositoryIntelligence>(
      `/repositories/${repositoryId}/intelligence${refresh ? '?refresh=1' : ''}`
    );
    return response.data;
  },

  wikiProse: async (repositoryId: string, path: string): Promise<WikiProseResult> => {
    const response = await api.post<WikiProseResult>(
      `/repositories/${repositoryId}/intelligence/wiki/${encodeURIComponent(path)}/prose`
    );
    return response.data;
  },

  query: async (
    repositoryId: string,
    question: string,
    useLlm = false
  ): Promise<RepositoryQueryResult> => {
    const response = await api.post<RepositoryQueryResult>(`/repositories/${repositoryId}/query`, {
      question,
      use_llm: useLlm,
    });
    return response.data;
  },

  architectureSmells: async (repositoryId: string): Promise<ArchitectureSmellsResult> => {
    const response = await api.get<ArchitectureSmellsResult>(
      `/repositories/${repositoryId}/architecture-smells`
    );
    return response.data;
  },

  healthTimeline: async (repositoryId: string): Promise<HealthTimeline> => {
    const response = await api.get<HealthTimeline>(
      `/repositories/${repositoryId}/health-timeline`
    );
    return response.data;
  },
};

export const researchService = {
  multiAgent: async (repositoryId: string): Promise<MultiAgentResult> => {
    const response = await api.get<MultiAgentResult>(`/repositories/${repositoryId}/multi-agent`);
    return response.data;
  },

  selfImprovement: async (repositoryId: string): Promise<SelfImprovementResult> => {
    const response = await api.get<SelfImprovementResult>(`/repositories/${repositoryId}/self-improvement`);
    return response.data;
  },

  vulnMining: async (repositoryId: string): Promise<VulnMiningResult> => {
    const response = await api.get<VulnMiningResult>(`/repositories/${repositoryId}/vuln-mining`);
    return response.data;
  },

  riskModel: async (repositoryId: string): Promise<RiskModelResult> => {
    const response = await api.get<RiskModelResult>(`/repositories/${repositoryId}/risk-model`);
    return response.data;
  },

  learningPatterns: async (): Promise<LearningPatternsResult> => {
    const response = await api.get<LearningPatternsResult>('/learning/patterns');
    return response.data;
  },
};

export const billingService = {
  overview: async (): Promise<BillingOverview> => {
    const response = await api.get<BillingOverview>('/billing');
    return response.data;
  },

  checkout: async (plan: string): Promise<CheckoutResult> => {
    const response = await api.post<CheckoutResult>(`/billing/checkout?plan=${plan}`);
    return response.data;
  },

  portal: async (): Promise<{ url: string }> => {
    const response = await api.post<{ url: string }>('/billing/portal');
    return response.data;
  },

  demoActivate: async (plan: string): Promise<CheckoutResult> => {
    const response = await api.post<CheckoutResult>(`/billing/demo/activate?plan=${plan}`);
    return response.data;
  },
};

export const prAuditService = {
  analyze: async (repositoryId: string, prNumber: number): Promise<PullRequestAuditDetail> => {
    const response = await api.post<PullRequestAuditDetail>(
      `/repositories/${repositoryId}/pull-requests/analyze`,
      { pr_number: prNumber }
    );
    return response.data;
  },

  list: async (params?: { repository_id?: string }): Promise<PullRequestAuditSummary[]> => {
    const response = await api.get<PullRequestAuditSummary[]>('/pull-requests', { params });
    return response.data;
  },

  get: async (auditId: string): Promise<PullRequestAuditDetail> => {
    const response = await api.get<PullRequestAuditDetail>(`/pull-requests/${auditId}`);
    return response.data;
  },

  listForRepository: async (repositoryId: string): Promise<PullRequestAuditSummary[]> => {
    const response = await api.get<PullRequestAuditSummary[]>(
      `/repositories/${repositoryId}/pull-requests`
    );
    return response.data;
  },

  postReview: async (repositoryId: string, auditId: string) => {
    const response = await api.post<{
      status: string;
      audit_id: string;
      review_id?: number;
      html_url?: string;
      comment_count: number;
    }>(`/repositories/${repositoryId}/pull-requests/${auditId}/post`);
    return response.data;
  },
};

export const onboardingService = {
  status: async (): Promise<OnboardingStatus> => {
    const response = await api.get<OnboardingStatus>('/onboarding/status');
    return response.data;
  },

  complete: async (): Promise<{ completed: boolean; completed_at?: string | null }> => {
    const response = await api.post<{ completed: boolean; completed_at?: string | null }>(
      '/onboarding/complete'
    );
    return response.data;
  },
};

export { api };
export default api;
export const websiteService = {
  list: async (): Promise<Website[]> => {
    const response = await api.get<Website[]>('/websites');
    return response.data;
  },

  register: async (url: string): Promise<Website> => {
    const response = await api.post<Website>('/websites', { url });
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/websites/${id}`);
  },

  listAudits: async (websiteId: string): Promise<WebsiteAudit[]> => {
    const response = await api.get<WebsiteAudit[]>(`/websites/${websiteId}/audits`);
    return response.data;
  },

  createAudit: async (
    websiteId: string,
    params?: { max_pages?: number; max_depth?: number }
  ): Promise<WebsiteAudit> => {
    const response = await api.post<WebsiteAudit>(`/websites/${websiteId}/audits`, params ?? {});
    return response.data;
  },

  getAudit: async (websiteId: string, auditId: string): Promise<WebsiteAuditDetail> => {
    const response = await api.get<WebsiteAuditDetail>(`/websites/${websiteId}/audits/${auditId}`);
    return response.data;
  },
};
