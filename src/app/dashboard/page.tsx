'use client';

import { useEffect, useState } from 'react';
import { fetchOverview } from '@/lib/api';
import type { OverviewStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview()
      .then(setStats)
      .catch(() => setError('Could not load stats'));
  }, []);

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total users', value: stats.totalUsers.toLocaleString() },
    {
      label: 'Premium (DB flag)',
      value: stats.premiumUsers.toLocaleString(),
      hint: 'App access — from Postgres, not RevenueCat',
    },
    {
      label: 'Billable (heuristic)',
      value: stats.premiumBreakdown.heuristicBillable.toLocaleString(),
      hint: 'Store product + active/grace/cancelled + period not ended',
    },
    { label: 'Premium rate', value: `${stats.premiumRate}%` },
    { label: 'Signups (7d)', value: stats.signups7d.toLocaleString() },
    { label: 'Signups (30d)', value: stats.signups30d.toLocaleString() },
    { label: 'Total expenses logged', value: stats.totalExpenses.toLocaleString() },
    { label: 'Expenses (7d)', value: stats.expenses7d.toLocaleString() },
    { label: 'Active push devices', value: stats.activeDevices.toLocaleString() },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Updated {new Date(stats.generatedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
              {'hint' in c && c.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.premiumBreakdown.stalePeriodEnd > 0 || stats.premiumBreakdown.statusExpired > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Premium drift</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.premiumBreakdown.stalePeriodEnd} users still flagged premium after{' '}
            <code className="rounded bg-muted px-1">premiumUntil</code> passed;{' '}
            {stats.premiumBreakdown.statusExpired} have status expired. RevenueCat “Active subscriptions” only
            counts live paid subs — use Billing ops / Operations to reconcile.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Premium by status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.subscriptionBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No premium subscribers yet.</p>
            ) : (
              stats.subscriptionBreakdown.map((r) => (
                <Badge key={r.status} variant="secondary">
                  {r.status}: {r.count}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Devices by platform</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.platformBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registered devices.</p>
            ) : (
              stats.platformBreakdown.map((r) => (
                <Badge key={r.platform} variant="outline">
                  {r.platform}: {r.count}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
