import axios, { isAxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
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

const ACCESS_KEY = 'te_admin_token';
const REFRESH_KEY = 'te_admin_refresh';
/** Refresh this long before the access token expires so requests don't race the expiry. */
const REFRESH_SKEW_MS = 30_000;
const AUTH_PATHS = ['/api/admin/auth/login', '/api/admin/auth/refresh', '/api/admin/auth/logout'];

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode) — tokens live in memory only
  }
}

let accessToken: string | null = null;
let refreshTokenMem: string | null = null;

export function loadStoredToken(): string | null {
  return accessToken ?? read(ACCESS_KEY);
}

function loadRefreshToken(): string | null {
  return refreshTokenMem ?? read(REFRESH_KEY);
}

export function setSession(tokens: SessionTokens | null) {
  accessToken = tokens?.token ?? null;
  refreshTokenMem = tokens?.refreshToken ?? null;
  write(ACCESS_KEY, accessToken);
  write(REFRESH_KEY, refreshTokenMem);
}

/** Re-read tokens from storage (another tab may have rotated or cleared them). */
function syncFromStorage() {
  accessToken = read(ACCESS_KEY);
  refreshTokenMem = read(REFRESH_KEY);
}

export function hasSession(): boolean {
  return !!loadRefreshToken();
}

// ---------------------------------------------------------------------------
// Session-ended notifications (forced logout)
// ---------------------------------------------------------------------------

export type SessionEndReason = 'expired' | 'signed_out' | 'other_tab';
type Listener = (reason: SessionEndReason) => void;
const listeners = new Set<Listener>();

export function onSessionEnded(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function endSession(reason: SessionEndReason) {
  const had = !!loadRefreshToken() || !!loadStoredToken();
  setSession(null);
  if (had || reason === 'other_tab') listeners.forEach((fn) => fn(reason));
}

if (typeof window !== 'undefined') {
  // Another tab signed out (or its session was killed): follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== REFRESH_KEY && e.key !== null) return;
    const hadSession = !!refreshTokenMem;
    syncFromStorage();
    if (hadSession && !refreshTokenMem) listeners.forEach((fn) => fn('other_tab'));
  });
}

// ---------------------------------------------------------------------------
// Token refresh (rotating refresh token)
// ---------------------------------------------------------------------------

class SessionEndedError extends Error {}

function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isFresh(token: string | null): token is string {
  if (!token) return false;
  const exp = tokenExpiresAt(token);
  return exp !== null && exp - REFRESH_SKEW_MS > Date.now();
}

/**
 * Serialize refreshes across tabs: the refresh token is single-use, so two tabs
 * rotating the same token would look like token theft and kill the session.
 */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('te_admin_refresh', fn) as Promise<T>;
  }
  return fn();
}

async function doRefresh(staleAccess: string | null): Promise<string> {
  return withRefreshLock(async () => {
    syncFromStorage();
    // Another tab refreshed while we waited for the lock — use its token.
    if (accessToken && accessToken !== staleAccess && isFresh(accessToken)) return accessToken;

    const refreshToken = loadRefreshToken();
    if (!refreshToken) {
      endSession('expired');
      throw new SessionEndedError('Session expired');
    }
    try {
      const res = await axios.post(
        `${baseURL}/api/admin/auth/refresh`,
        { refreshToken },
        { timeout: 15000 }
      );
      const data = res.data?.data as SessionTokens | undefined;
      if (!data?.token || !data.refreshToken) throw new Error('Malformed refresh response');
      setSession({ token: data.token, refreshToken: data.refreshToken });
      return data.token;
    } catch (err) {
      // 401 = session revoked/expired → force logout. Network/5xx → keep session, surface error.
      if (isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 400)) {
        endSession('expired');
        throw new SessionEndedError('Session expired');
      }
      throw err;
    }
  });
}

let inflight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!inflight) {
    inflight = doRefresh(loadStoredToken()).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function isAuthPath(config: InternalAxiosRequestConfig): boolean {
  return AUTH_PATHS.some((p) => config.url?.startsWith(p));
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const http: AxiosInstance = axios.create({ baseURL, timeout: 30000 });

http.interceptors.request.use(async (config) => {
  if (isAuthPath(config)) return config;
  let t = loadStoredToken();
  if (!isFresh(t) && loadRefreshToken()) t = await refreshAccessToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

http.interceptors.response.use(undefined, async (err) => {
  if (!isAxiosError(err) || err.response?.status !== 401 || !err.config) throw err;
  const config = err.config as RetriableConfig;
  if (isAuthPath(config)) throw err;
  if (config._retried || !loadRefreshToken()) {
    endSession('expired');
    throw err;
  }
  config._retried = true;
  const t = await refreshAccessToken();
  config.headers.Authorization = `Bearer ${t}`;
  return http.request(config);
});

function client(): AxiosInstance {
  return http;
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

/** Why sign-in was refused, when the API says: a second-factor code is needed or was wrong. */
export class LoginError extends Error {
  constructor(
    message: string,
    readonly code?: 'totp_required' | 'totp_invalid'
  ) {
    super(message);
  }
}

export async function login(email: string, password: string, totp?: string) {
  try {
    const res = await client().post('/api/admin/auth/login', {
      email: email.trim().toLowerCase(),
      password,
      ...(totp ? { totp } : {}),
    });
    const data = res.data?.data;
    if (!data?.token || !data?.refreshToken) throw new Error('Login failed');
    setSession({ token: data.token, refreshToken: data.refreshToken });
    return data as { admin: { id: string; email: string; name: string | null } } & SessionTokens;
  } catch (err) {
    const code = isAxiosError(err) ? err.response?.data?.code : undefined;
    throw new LoginError(
      apiErrorMessage(err, 'Login failed'),
      code === 'totp_required' || code === 'totp_invalid' ? code : undefined
    );
  }
}

/** Revoke this browser's session on the server (best effort) and clear local tokens. */
export async function logout(): Promise<void> {
  const refreshToken = loadRefreshToken();
  setSession(null);
  if (!refreshToken) return;
  try {
    await client().post('/api/admin/auth/logout', { refreshToken });
  } catch {
    // Server unreachable: tokens are already gone locally; the session idles out server-side.
  }
}

/** Sign out every browser for this admin account. */
export async function logoutEverywhere(): Promise<void> {
  await client().post('/api/admin/auth/logout-all');
  setSession(null);
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
  access?: import('./types').UserAccessFilter,
  limit = 20
) {
  const res = await client().get('/api/admin/users', {
    params: { page, limit, search, access: access && access !== 'all' ? access : undefined },
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
    /** ISO datetime, or null for lifetime (API stores ~100 years from grant) */
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

export async function fetchAuditLogs(page: number, action?: string) {
  const res = await client().get('/api/admin/audit', {
    params: { page, limit: 30, action: action && action !== 'all' ? action : undefined },
  });
  return res.data.data as {
    items: AdminAuditLogRow[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

export async function fetchSystemHealth(): Promise<import('./types').SystemHealth> {
  const res = await client().get('/api/admin/system/health');
  return res.data.data;
}

export async function fetchSystemBackups(): Promise<import('./types').SystemBackups> {
  const res = await client().get('/api/admin/system/backups');
  return res.data.data;
}

/** Audit-logged on the API, and announced on Telegram. */
export async function createBackupDownloadLink(key: string): Promise<{ url: string; expiresAt: string }> {
  try {
    const res = await client().post('/api/admin/system/backups/link', { key });
    return res.data.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Could not create download link'));
  }
}

export async function sendTestAlert(): Promise<void> {
  try {
    await client().post('/api/admin/system/alerts/test');
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Could not send test alert'));
  }
}

export async function fetchAiUsage(days = 30) {
  const res = await client().get('/api/admin/ai/usage', { params: { days } });
  return res.data.data as import('./types').AiUsageResponse;
}

export async function fetchTopAiUsers(
  period: import('./types').TopAiUsersPeriod,
  sort: import('./types').TopAiUsersSort,
  limit = 20
) {
  const res = await client().get('/api/admin/ai/top-users', { params: { period, sort, limit } });
  return res.data.data as import('./types').TopAiUsersResponse;
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
