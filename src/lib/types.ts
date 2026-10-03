export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

export interface OverviewStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  premiumRate: number;
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

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  isPremium: boolean;
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

export interface AdminAuditLogRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; email: string; name: string | null };
}

export interface UserDetail extends Omit<UserListItem, '_count'> {
  pushEnabled: boolean;
  budgetAlertsEnabled: boolean;
  updatedAt: string;
  _count: {
    expenses: number;
    insights: number;
    goals: number;
    budgets: number;
    deviceTokens: number;
    recurringRules: number;
  };
}
