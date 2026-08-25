import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import type {
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  User,
  Family,
  FamilyUpdateRequest,
  Holding,
  HoldingCreateRequest,
  HoldingUpdateRequest,
  MarketQuote,
  MarketPrice,
  Account,
  AccountSummary,
  AccountCreateRequest,
  AccountUpdateRequest,
  MemberCreateRequest,
  MemberInviteInformation,
  PasswordResetToken,
  BackupData,
  RestoreResult,
  PortfolioSnapshot,
} from '../types';

const extractErrorMessage = (error: any, fallback = 'Request failed'): string => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstItem = detail[0];
    if (typeof firstItem === 'string' && firstItem.trim()) {
      return firstItem;
    }
    if (firstItem && typeof firstItem === 'object') {
      const firstItemMessage = firstItem.msg || firstItem.message;
      if (typeof firstItemMessage === 'string' && firstItemMessage.trim()) {
        return firstItemMessage;
      }
    }
  }

  return fallback;
};

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Request interceptor — attach access token from Zustand store
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with refresh token rotation
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl: string = originalRequest?.url || '';
    const isAuthFlowRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');
    const { refreshToken, isAuthenticated, setAuth, setSessionExpired, clearAuth } =
      useAuthStore.getState();

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthFlowRequest &&
      refreshToken
    ) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        setAuth(response.data);
        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        const isServerUnreachable = !refreshError.response;

        if (isServerUnreachable && isAuthenticated) {
          setSessionExpired(true);
          return Promise.reject(refreshError);
        }

        clearAuth();
        if (window.location.pathname !== '/login') {
          window.history.pushState({}, '', '/login');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        return Promise.reject(refreshError);
      }
    }

    // Show toast for non-GET mutation errors (not auth flow, not network errors)
    const isGetRequest = originalRequest?.method?.toLowerCase() === 'get';
    const isNetworkError = !error.response;
    const shouldShowGlobalToast =
      !requestUrl.includes('/auth/login') && !isGetRequest && !isNetworkError;
    if (shouldShowGlobalToast) {
      toast.error(extractErrorMessage(error));
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },
};

// Accounts API
export const accountsAPI = {
  getAll: async (): Promise<AccountSummary[]> => {
    const response = await api.get<AccountSummary[]>('/accounts');
    return response.data;
  },

  getById: async (id: string): Promise<Account> => {
    const response = await api.get<Account>(`/accounts/${id}`);
    return response.data;
  },

  getSummary: async (id: string): Promise<AccountSummary> => {
    const response = await api.get<AccountSummary>(`/accounts/${id}/summary`);
    return response.data;
  },

  create: async (data: AccountCreateRequest): Promise<Account> => {
    const response = await api.post<Account>('/accounts', data);
    return response.data;
  },

  update: async (id: string, data: AccountUpdateRequest): Promise<Account> => {
    const response = await api.put<Account>(`/accounts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  reorder: async (items: { id: string; sort_order: number }[]): Promise<void> => {
    await api.put('/accounts/reorder', items);
  },
};

// Holdings API
export const holdingsAPI = {
  getAll: async (accountId?: string, includeDrafts = false): Promise<Holding[]> => {
    const params: Record<string, any> = {};
    if (accountId) params.account_id = accountId;
    if (includeDrafts) params.include_drafts = true;
    const response = await api.get<Holding[]>('/holdings', { params });
    return response.data;
  },

  create: async (data: HoldingCreateRequest): Promise<Holding> => {
    const response = await api.post<Holding>('/holdings', data);
    return response.data;
  },

  update: async (id: string, data: HoldingUpdateRequest): Promise<Holding> => {
    const response = await api.put<Holding>(`/holdings/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/holdings/${id}`);
  },
};

// Family API
export const familyAPI = {
  get: async (): Promise<Family> => {
    const response = await api.get<Family>('/admin/family');
    return response.data;
  },

  update: async (data: FamilyUpdateRequest): Promise<Family> => {
    const response = await api.patch<Family>('/admin/family', data);
    return response.data;
  },
};

// Admin member API
export const adminAPI = {
  getMembers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/admin/members');
    return response.data;
  },

  createMember: async (data: MemberCreateRequest): Promise<MemberInviteInformation> => {
    const response = await api.post<MemberInviteInformation>('/admin/members', data);
    return response.data;
  },

  updateMember: async (id: string, data: { role?: string; active?: boolean }): Promise<User> => {
    const response = await api.put<User>(`/admin/members/${id}`, data);
    return response.data;
  },

  deleteMember: async (id: string): Promise<void> => {
    await api.delete(`/admin/members/${id}`);
  },

  resetMemberPassword: async (id: string): Promise<PasswordResetToken> => {
    const response = await api.post<PasswordResetToken>(`/admin/members/${id}/reset-password`);
    return response.data;
  },
};

// Market API
export const marketAPI = {
  getQuote: async (symbol: string): Promise<MarketQuote> => {
    const response = await api.get<MarketQuote>(`/market/quote/${symbol}`);
    return response.data;
  },

  getPrice: async (symbol: string): Promise<MarketPrice> => {
    const response = await api.get<MarketPrice>(`/market/price/${symbol}`);
    return response.data;
  },

  getBatchPrices: async (symbols: string): Promise<Record<string, MarketPrice>> => {
    const response = await api.get<Record<string, MarketPrice>>('/market/prices', {
      params: { symbols },
    });
    return response.data;
  },
};

// Portfolio history API — real daily snapshots, see backend app.snapshot
export const portfolioAPI = {
  getHistory: async (days = 30): Promise<PortfolioSnapshot[]> => {
    const response = await api.get<PortfolioSnapshot[]>('/portfolio/history', {
      params: { days },
    });
    return response.data;
  },

  triggerSnapshot: async (): Promise<PortfolioSnapshot> => {
    const response = await api.post<PortfolioSnapshot>('/portfolio/snapshot');
    return response.data;
  },
};

// Backup & Restore API
export const backupAPI = {
  download: async (userIds?: string[]): Promise<BackupData> => {
    const params: Record<string, string> = {};
    if (userIds && userIds.length > 0) {
      params.user_ids = userIds.join(',');
    }
    const response = await api.get<BackupData>('/backup', { params });
    return response.data;
  },

  restore: async (file: File, mode: 'replace' | 'append' = 'replace'): Promise<RestoreResult> => {
    const formData = new FormData();
    formData.append('file', file);
    // null removes the instance-level 'application/json' default in Axios 1.6.x deepMerge
    // (undefined is skipped by deepMerge and does NOT override the default, causing Axios
    // to JSON-serialize the FormData instead of sending it as multipart)
    const response = await api.post<RestoreResult>(`/backup/restore?mode=${mode}`, formData, {
      headers: { 'Content-Type': null },
      timeout: 60000,
    });
    return response.data;
  },
};

export default api;
