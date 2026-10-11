export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

export interface PremiumBreakdown {
  dbFlag: number;
  manualComp: number;
  storeBacked: number;
  payingActive: number;
  heuristicBillable: number;
  withStoreProduct: number;
  stalePeriodEnd: number;
  statusExpired: number;
  noPremiumUntil: number;
}

export interface OverviewStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  premiumRate: number;
  premiumBreakdown: PremiumBreakdown;
  signups7d: number;
  signups30d: number;
  totalExpenses: number;
  expenses7d: number;
  activeDevices: number;
  subscriptionBreakdown: { status: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  generatedAt: string;
}

export interface GrowthPoint {
  date: string;
  signups: number;
  premiumSignups: number;
}

export type UserAccessFilter = 'all' | 'free' | 'premium' | 'manual' | 'store' | 'paying';
export type PremiumAccess = 'none' | 'store' | 'manual';

export type AccountModerationStatus = 'active' | 'suspended' | 'banned';

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  isPremium: boolean;
  premiumAccess?: PremiumAccess;
  accountStatus?: AccountModerationStatus;
  subscriptionStatus: string | null;
  subscriptionProductId: string | null;
  subscriptionStore: string | null;
  premiumSince: string | null;
  premiumUntil: string | null;
  createdAt: string;
  _count: { expenses: number; deviceTokens: number };
}

export interface BillingWebhookEventRow {
  id: string;
  externalEventId: string | null;
  eventType: string;
  appUserId: string | null;
  userId: string | null;
  productId: string | null;
  store: string | null;
  outcome: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
}

export interface BillingDriftUser {
  id: string;
  email: string;
  name: string | null;
  isPremium: boolean;
  subscriptionStatus: string | null;
  premiumUntil: string | null;
  subscriptionProductId: string | null;
  updatedAt: string;
  reason: string;
}

export interface AiUsageResponse {
  series: Array<{ date: string; total: number; byKind: Record<string, number> }>;
  totals: Record<string, number>;
  fallbacks: Record<string, number>;
}

export interface AiUsageStats {
  calls: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD at Gemini paid-tier list price */
  costUsd: number;
}

export interface UserAiUsageResponse {
  days: number;
  note?: string;
  totals: AiUsageStats & { legacyCostUsd: number; activeDays: number };
  byKind: Record<string, AiUsageStats>;
  byModel: Record<string, AiUsageStats & { priced: boolean }>;
  series: Array<{
    date: string;
    totalCalls: number;
    totalTokens: number;
    costUsd: number;
    byKind: Record<string, AiUsageStats>;
  }>;
  lifetime: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    since: string | null;
  } | null;
  /** Last 12 months from the permanent rollup, oldest first */
  monthly: Array<{ month: string; calls: number; costUsd: number }>;
  pricing: Record<string, { input: number; output: number }>;
}

export interface QueueMonitorResponse {
  queues: Array<{
    name: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    recentFailed: Array<{ id: string; name: string; failedReason: string; timestamp: number }>;
  }>;
  generatedAt: string;
}

export interface RagHealthResponse {
  postgres: {
    expenses: number;
    vectorRows: number;
    usersWithEmbeddings: number;
    missingEmbeddingsEstimate: number;
  };
  pinecone: {
    ready: boolean;
    indexName: string;
    totalVectors: number | null;
    dimension: number | null;
  };
  generatedAt: string;
}

export type RevenueCatSyncResponse =
  | { configured: false; message: string }
  | {
      configured: true;
      entitlementId: string;
      dbPremiumCount: number;
      sampled: number;
      rcActiveInSample: number;
      mismatchCount: number;
      mismatches: Array<{
        userId: string;
        email: string;
        dbPremium: boolean;
        rcPremium: boolean;
        reason: string;
      }>;
      generatedAt: string;
    };

export interface AdminAuditLogRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; email: string; name: string | null };
  targetUser?: { id: string; email: string; name: string | null } | null;
}

export interface SubscriptionSummary {
  plan: string | null;
  planLabel: string | null;
  status: string | null;
  premiumSince: string | null;
  premiumUntil: string | null;
  productId: string | null;
  store: string | null;
  summaryLine: string | null;
}

export interface UserBillingEventRow {
  id: string;
  externalEventId: string | null;
  eventType: string;
  productId: string | null;
  store: string | null;
  outcome: string;
  createdAt: string;
}

export type UserRevenueCatLookup =
  | { configured: false; message: string }
  | {
      configured: true;
      entitlementId: string;
      dbPremium: boolean;
      rcPremium: boolean;
      inSync: boolean;
      subscriberFound: boolean;
      expiresDate: string | null;
      productId: string | null;
      reason: string | null;
    };

export interface UserDetail extends Omit<UserListItem, '_count'> {
  suspendedAt?: string | null;
  bannedAt?: string | null;
  moderationNote?: string | null;
  pushEnabled: boolean;
  budgetAlertsEnabled: boolean;
  tokenVersion?: number;
  updatedAt: string;
  lastExpenseAt?: string | null;
  /** Last authenticated app request (hourly precision; null before tracking started) */
  lastActiveAt?: string | null;
  subscription?: SubscriptionSummary;
  premiumAccess?: PremiumAccess;
  subscriptionDrift?: string | null;
  billingEvents?: UserBillingEventRow[];
  revenueCat?: UserRevenueCatLookup;
  _count: {
    expenses: number;
    insights: number;
    goals: number;
    budgets: number;
    deviceTokens: number;
    recurringRules: number;
  };
}

export interface SystemHealth {
  /** down = database unreachable; degraded = Redis down or migrations not fully applied */
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  nodeEnv: string;
  redis?: { ok: boolean; message: string };
  database: { ok: boolean; latencyMs: number | null; version: string | null; message?: string };
  migrations: {
    total: number;
    applied: number;
    pending: string[];
    failed: string[];
    latestApplied: { name: string; appliedAt: string } | null;
    historyMissing: boolean;
  } | null;
  deploy: {
    commit: string | null;
    commitMessage: string | null;
    committedAt: string | null;
    startedAt: string;
  };
  /** null when alert state couldn't be read (Redis down) */
  alerts: {
    telegramConfigured: boolean;
    envLabel: string;
    monitorLastRun: { at: string; checks: number; firing: number } | null;
    firing: Array<{ key: string; title: string; severity: 'critical' | 'warning' | 'info'; since: string }>;
  } | null;
}

export interface SystemBackups {
  configured: boolean;
  bucket: string | null;
  total: number;
  items: Array<{ key: string; fileName: string; sizeBytes: number; createdAt: string }>;
  /** From the backup script's marker file on the API host; null if not readable there */
  lastSuccessAt: string | null;
}

export type TopAiUsersPeriod = 'month' | 'prev_month' | 'all';

export type TopAiUsersSort = 'cost' | 'tokens' | 'margin';

export interface TopAiUsersResponse {
  period: TopAiUsersPeriod;
  /** YYYY-MM for monthly periods, null for all-time. */
  month: string | null;
  sort: TopAiUsersSort;
  /** Monthly AI cost above which a free user is flagged. */
  freeUserThresholdUsd: number;
  summary: { users: number; aiCostUsd: number; revenueUsd: number; flagged: number };
  rows: Array<{
    userId: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
    costUsd: number;
    topKind: string | null;
    /** Net production revenue (charges minus refunds) in the period. */
    revenueUsd: number;
    marginUsd: number;
    flag: 'free_high_cost' | 'cost_exceeds_revenue' | null;
    /** null when the account was deleted (its usage rollups are kept). */
    user: { id: string; email: string; name: string | null; isPremium: boolean } | null;
  }>;
}
