import axios, { isAxiosError, type AxiosInstance } from 'axios';
import type {
  AdminAuditLogRow,
  BillingDriftUser,
  BillingWebhookEventRow,
  GrowthPoint,
  OverviewStats,
  UserDetail,
  UserListItem,
} from './types';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7100';

let token: string | null = null;

export function setAuthToken(t: string | null) {
  token = t;
  if (typeof window !== 'undefined') {
    if (t) localStorage.setItem('te_admin_token', t);
    else localStorage.removeItem('te_admin_token');
  }
}

export function loadStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('te_admin_token');
}

function client(): AxiosInstance {
  const c = axios.create({ baseURL, timeout: 30000 });
  c.interceptors.request.use((config) => {
    const t = token ?? loadStoredToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });
  return c;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (err.response?.status === 401) return 'Invalid email or password';
  }
  return fallback;
}

export async function fetchMe() {
  const res = await client().get('/api/admin/auth/me');
  return res.data.data.admin as { id: string; email: string; name: string | null };
}

export async function login(email: string, password: string) {
  try {
    const res = await client().post('/api/admin/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    const tok = res.data?.data?.token as string;
    if (!tok) throw new Error('Login failed');
    setAuthToken(tok);
    return res.data.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Login failed'));
  }
}

export async function fetchOverview(): Promise<OverviewStats> {
  const res = await client().get('/api/admin/stats/overview');
  return res.data.data;
}

export async function fetchGrowth(days = 30): Promise<GrowthPoint[]> {
  const res = await client().get('/api/admin/growth', { params: { days } });
  return res.data.data;
}

export async function fetchUsers(
  page: number,
  search?: string,
  access?: import('./types').UserAccessFilter
) {
  const res = await client().get('/api/admin/users', {
    params: { page, limit: 20, search, access: access && access !== 'all' ? access : undefined },
  });
  return res.data.data as {
    items: UserListItem[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

export async function fetchUser(id: string): Promise<UserDetail> {
  const res = await client().get(`/api/admin/users/${id}`);
  return res.data.data;
}

export async function patchUser(
  id: string,
  body: {
    isPremium?: boolean;
    subscriptionStatus?: string | null;
    /** ISO datetime, or null for no fixed end (lifetime manual comp) */
    premiumUntil?: string | null;
  }
): Promise<{ user: UserDetail; premiumEmailSent?: boolean }> {
  const res = await client().patch(`/api/admin/users/${id}`, body);
  return {
    user: res.data.data as UserDetail,
    premiumEmailSent: res.data.meta?.premiumEmailSent as boolean | undefined,
  };
}

export async function revokeUserSessions(id: string) {
  const res = await client().post(`/api/admin/users/${id}/revoke-sessions`);
  return res.data.data as { id: string; email: string; tokenVersion: number };
}

export async function moderateUser(
  id: string,
  action: 'suspend' | 'ban' | 'reactivate',
  note?: string
) {
  const res = await client().post(`/api/admin/users/${id}/moderation`, { action, note });
  return res.data.data as UserDetail;
}

export async function fetchBillingEvents(page: number) {
  const res = await client().get('/api/admin/billing/events', { params: { page, limit: 30 } });
  return res.data.data as {
    items: BillingWebhookEventRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

export async function fetchBillingDrift() {
  const res = await client().get('/api/admin/billing/drift');
  return res.data.data as { items: BillingDriftUser[]; count: number };
}

export async function fetchAuditLogs(page: number) {
  const res = await client().get('/api/admin/audit', { params: { page, limit: 30 } });
  return res.data.data as {
    items: AdminAuditLogRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

export async function fetchSystemHealth() {
  const res = await client().get('/api/admin/system/health');
  return res.data.data as {
    status: string;
    timestamp: string;
    uptime: number;
    nodeEnv: string;
    redis?: { ok: boolean; message: string };
  };
}

export async function fetchAiUsage(days = 30) {
  const res = await client().get('/api/admin/ai/usage', { params: { days } });
  return res.data.data as import('./types').AiUsageResponse;
}

export async function fetchUserAiUsage(userId: string, days = 30) {
  const res = await client().get(`/api/admin/users/${userId}/ai-usage`, { params: { days } });
  return res.data.data as import('./types').UserAiUsageResponse;
}

export async function fetchQueueMonitor() {
  const res = await client().get('/api/admin/queues');
  return res.data.data as import('./types').QueueMonitorResponse;
}

export async function fetchRagHealth() {
  const res = await client().get('/api/admin/rag/health');
  return res.data.data as import('./types').RagHealthResponse;
}

export async function fetchRevenueCatSync(limit = 200) {
  const res = await client().get('/api/admin/integrations/revenuecat', { params: { limit } });
  return res.data.data as import('./types').RevenueCatSyncResponse;
}

export async function reconcileStalePremium() {
  const res = await client().post('/api/admin/billing/reconcile-stale');
  return res.data.data as { updated: number };
}
