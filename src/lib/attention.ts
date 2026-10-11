'use client';

import { create } from 'zustand';
import {
  fetchBillingDrift,
  fetchOverview,
  fetchQueueMonitor,
  fetchSystemBackups,
  fetchSystemHealth,
  fetchTopAiUsers,
} from './api';
import type {
  BillingDriftUser,
  OverviewStats,
  QueueMonitorResponse,
  SystemBackups,
  SystemHealth,
  TopAiUsersResponse,
} from './types';
import { ago, queueLabel } from './format';

/** Monitor runs every 15 min; flag it after two missed runs. */
export const MONITOR_STALE_MS = 35 * 60 * 1000;
/** Backups are nightly; flag after a missed night. */
export const BACKUP_STALE_MS = 26 * 60 * 60 * 1000;
/** A waiting queue this deep means workers are behind. */
const QUEUE_BACKLOG = 50;
/** Refresh in the background this often while the console is open. */
const POLL_MS = 5 * 60 * 1000;

export type AttentionTone = 'critical' | 'warn';

export type AttentionItem = {
  id: string;
  tone: AttentionTone;
  /** Shown as the large figure; omit for yes/no problems. */
  figure?: number;
  title: string;
  detail?: string;
  href: string;
  action: string;
};

type Sources = {
  overview: OverviewStats | null;
  drift: BillingDriftUser[] | null;
  health: SystemHealth | null;
  backups: SystemBackups | null;
  queues: QueueMonitorResponse | null;
  aiUsers: TopAiUsersResponse | null;
};

type AttentionState = Sources & {
  status: 'idle' | 'loading' | 'ready';
  checkedAt: number | null;
  /** Sources that could not be read on the last check. */
  failed: string[];
  items: AttentionItem[];
  refresh: () => Promise<void>;
  startPolling: () => () => void;
};

const SOURCE_LABELS: Record<keyof Sources, string> = {
  overview: 'user stats',
  drift: 'billing drift',
  health: 'system health',
  backups: 'backups',
  queues: 'job queues',
  aiUsers: 'AI cost per user',
};

function deriveItems(s: Sources, now: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  const h = s.health;

  if (h?.status === 'down' || (h && !h.database.ok)) {
    items.push({
      id: 'db-down',
      tone: 'critical',
      title: 'The database is unreachable',
      detail: h.database.message ?? 'The API cannot read or write user data.',
      href: '/dashboard/system',
      action: 'Open system',
    });
  }
  if (h?.redis && !h.redis.ok) {
    items.push({
      id: 'redis-down',
      tone: 'critical',
      title: 'Redis is down',
      detail: 'Background jobs, rate limits and alert state are not working.',
      href: '/dashboard/system',
      action: 'Open system',
    });
  }
  for (const a of h?.alerts?.firing ?? []) {
    items.push({
      id: `alert-${a.key}`,
      tone: a.severity === 'critical' ? 'critical' : 'warn',
      title: a.title,
      detail: `Alert firing since ${ago(a.since)}.`,
      href: '/dashboard/system',
      action: 'Open system',
    });
  }
  const m = h?.migrations;
  if (m?.failed.length) {
    items.push({
      id: 'migrations-failed',
      tone: 'critical',
      figure: m.failed.length,
      title: m.failed.length === 1 ? 'Migration did not finish' : 'Migrations did not finish',
      detail: m.failed.join(', '),
      href: '/dashboard/system',
      action: 'Open system',
    });
  } else if (m?.pending.length && !m.historyMissing) {
    items.push({
      id: 'migrations-pending',
      tone: 'warn',
      figure: m.pending.length,
      title: m.pending.length === 1 ? 'Migration not applied yet' : 'Migrations not applied yet',
      detail: 'The running code may expect these tables or columns.',
      href: '/dashboard/system',
      action: 'Open system',
    });
  }
  const run = h?.alerts?.monitorLastRun;
  if (run && now - new Date(run.at).getTime() > MONITOR_STALE_MS) {
    items.push({
      id: 'monitor-stale',
      tone: 'warn',
      title: 'Alert monitor has stopped running',
      detail: `Last run ${ago(run.at)}. Telegram alerts may not be arriving.`,
      href: '/dashboard/system',
      action: 'Open system',
    });
  }
  if (h?.alerts && !h.alerts.telegramConfigured) {
    items.push({
      id: 'telegram-off',
      tone: 'warn',
      title: 'Telegram alerts are not configured',
      detail: 'Nobody is told when something breaks.',
      href: '/dashboard/system',
      action: 'Open system',
    });
  }

  const b = s.backups;
  if (b?.configured && b.lastSuccessAt && now - new Date(b.lastSuccessAt).getTime() > BACKUP_STALE_MS) {
    items.push({
      id: 'backup-stale',
      tone: 'critical',
      title: 'Nightly backup is overdue',
      detail: `Last successful backup ${ago(b.lastSuccessAt)}.`,
      href: '/dashboard/system#backups',
      action: 'Check backups',
    });
  }

  const pb = s.overview?.premiumBreakdown;
  const stale = (pb?.stalePeriodEnd ?? 0) + (pb?.statusExpired ?? 0);
  if (stale > 0) {
    items.push({
      id: 'premium-stale',
      tone: 'warn',
      figure: stale,
      title: stale === 1 ? 'User still has premium after it ended' : 'Users still have premium after it ended',
      detail: 'Their period end has passed or their status is expired. Clearing is safe and logged.',
      href: '/dashboard/billing',
      action: 'Review and clear',
    });
  }
  if (s.drift?.length) {
    items.push({
      id: 'drift',
      tone: 'warn',
      figure: s.drift.length,
      title: s.drift.length === 1 ? 'Account has inconsistent subscription data' : 'Accounts have inconsistent subscription data',
      detail: 'Often self-heals on the next RevenueCat webhook. Check before changing premium by hand.',
      href: '/dashboard/billing',
      action: 'Open billing',
    });
  }

  for (const q of s.queues?.queues ?? []) {
    if (q.counts.waiting >= QUEUE_BACKLOG) {
      items.push({
        id: `backlog-${q.name}`,
        tone: 'warn',
        figure: q.counts.waiting,
        title: `${queueLabel(q.name)} jobs waiting`,
        detail: `${q.counts.active} running now. Workers may be stuck or under-provisioned.`,
        href: '/dashboard/operations#queues',
        action: 'Open queues',
      });
    }
  }
  const recentFails = (s.queues?.queues ?? []).reduce(
    (n, q) => n + q.recentFailed.filter((f) => now - f.timestamp < 24 * 60 * 60 * 1000).length,
    0
  );
  if (recentFails > 0) {
    items.push({
      id: 'jobs-failed',
      tone: 'warn',
      figure: recentFails,
      title: recentFails === 1 ? 'Background job failed today' : 'Background jobs failed today',
      detail: 'Imports, parsing or briefings that did not finish for a user.',
      href: '/dashboard/operations#queues',
      action: 'See failures',
    });
  }

  const flagged = s.aiUsers?.summary.flagged ?? 0;
  if (flagged > 0) {
    items.push({
      id: 'ai-flagged',
      tone: 'warn',
      figure: flagged,
      title: flagged === 1 ? 'User costs more in AI than they pay' : 'Users cost more in AI than they pay',
      detail: 'This month, at Gemini list price.',
      href: '/dashboard/operations#ai-users',
      action: 'See users',
    });
  }

  const order: Record<AttentionTone, number> = { critical: 0, warn: 1 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}

export const useAttention = create<AttentionState>((set, get) => ({
  overview: null,
  drift: null,
  health: null,
  backups: null,
  queues: null,
  aiUsers: null,
  status: 'idle',
  checkedAt: null,
  failed: [],
  items: [],
  refresh: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    const jobs: { [K in keyof Sources]: Promise<Sources[K]> } = {
      overview: fetchOverview(),
      drift: fetchBillingDrift().then((d) => d.items),
      health: fetchSystemHealth(),
      backups: fetchSystemBackups(),
      queues: fetchQueueMonitor(),
      aiUsers: fetchTopAiUsers('month', 'margin', 50),
    };
    const keys = Object.keys(jobs) as (keyof Sources)[];
    const results = await Promise.allSettled(keys.map((k) => jobs[k]));
    const next = {} as Sources;
    const failed: string[] = [];
    results.forEach((r, i) => {
      const k = keys[i];
      if (r.status === 'fulfilled') (next as Record<string, unknown>)[k] = r.value;
      else {
        (next as Record<string, unknown>)[k] = get()[k];
        failed.push(SOURCE_LABELS[k]);
      }
    });
    const now = Date.now();
    set({ ...next, failed, items: deriveItems(next, now), checkedAt: now, status: 'ready' });
  },
  startPolling: () => {
    void get().refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void get().refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  },
}));

/** Attention counts per nav destination, for sidebar badges. */
export function attentionByPath(items: AttentionItem[]): Record<string, { n: number; tone: AttentionTone }> {
  const out: Record<string, { n: number; tone: AttentionTone }> = {};
  for (const it of items) {
    const path = it.href.split('#')[0];
    const cur = out[path];
    out[path] = {
      n: (cur?.n ?? 0) + 1,
      tone: cur?.tone === 'critical' || it.tone === 'critical' ? 'critical' : 'warn',
    };
  }
  return out;
}
