import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  User,
  TokenResponse,
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
  CheckoutResult
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
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
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

export { api };
export default api;