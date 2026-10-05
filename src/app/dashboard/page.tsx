'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOverview } from '@/lib/api';
import type { OverviewStats } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview()
      .then(setStats)
      .catch(() => setError('Could not load stats'));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-16 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Total users', value: stats.totalUsers.toLocaleString() },
    {
      label: 'Premium (DB flag)',
      value: stats.premiumUsers.toLocaleString(),
      hint: 'App access from Postgres, not RevenueCat',
    },
    {
      label: 'Billable (heuristic)',
      value: stats.premiumBreakdown.heuristicBillable.toLocaleString(),
      hint: 'Store product + active period',
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
      <PageHeader
        title="Overview"
        description="Live snapshot of users, premium access, and product usage."
        meta={`Updated ${new Date(stats.generatedAt).toLocaleString()}`}
        actions={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/operations" />}>
            Platform health
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} hint={c.hint} />
        ))}
      </div>

      {stats.premiumBreakdown.stalePeriodEnd > 0 || stats.premiumBreakdown.statusExpired > 0 ? (
        <Card className="border-amber-500/35 bg-amber-500/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Premium drift detected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {stats.premiumBreakdown.stalePeriodEnd} users still flagged premium after{' '}
              <code className="rounded bg-muted px-1">premiumUntil</code> passed;{' '}
              {stats.premiumBreakdown.statusExpired} have status expired. RevenueCat “Active subscriptions” only counts
              live paid subs.
            </p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/billing" />}>
              Open billing ops
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premium by status</CardTitle>
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
            <CardTitle className="text-base">Devices by platform</CardTitle>
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
