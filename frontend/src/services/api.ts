import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  User, 
  TokenResponse, 
  LoginRequest, 
  SignupRequest,
  Repository,
  RepositoryCreate,
  Scan,
  ScanCreate,
  ScanDetail,
  Finding,
  FindingDetail,
  Patch,
  VerificationRun,
  VerificationRunDetail,
  DashboardSummary,
  FindingSummary
} from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

const api = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

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
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },
};

export { api };
export default api;