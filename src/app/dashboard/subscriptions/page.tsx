'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOverview } from '@/lib/api';
import type { OverviewStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    fetchOverview().then(setStats);
  }, []);

  if (!stats) return <Skeleton className="h-64 w-full" />;

  const b = stats.premiumBreakdown;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Your database (RevenueCat webhooks + manual admin). Compare with RevenueCat → Overview →{' '}
          <strong>Active subscriptions</strong> (currently paying), not “Active customers”.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premium (DB flag)</CardTitle>
            <CardDescription>Who gets premium features in the app today</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.premiumUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billable (heuristic)</CardTitle>
            <CardDescription>Store product on file, period not ended, status not expired</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{b.heuristicBillable}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion</CardTitle>
            <CardDescription>DB premium / all users</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.premiumRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why DB ≠ RevenueCat?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">{b.withStoreProduct}</strong> premium users have a Play/App product
            id saved; <strong className="text-foreground">{b.noPremiumUntil}</strong> have no{' '}
            <code className="rounded bg-muted px-1">premiumUntil</code> (never auto-expire until a webhook or billing
            status check).
          </p>
          <p>
            Sandbox purchases, missed <code className="rounded bg-muted px-1">EXPIRATION</code> webhooks, or manual
            premium toggles leave the DB flag set while RevenueCat shows 0 active subscriptions.
          </p>
          <p>
            <Link href="/dashboard/operations" className="text-primary hover:underline">
              Operations → RevenueCat vs database
            </Link>{' '}
            lists mismatches when <code className="rounded bg-muted px-1">REVENUECAT_SECRET_API_KEY</code> is set.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>Among users with isPremium = true (webhook-synced fields)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {stats.subscriptionBreakdown.map((r) => (
              <li key={r.status} className="flex justify-between border-b py-2 last:border-0">
                <span className="capitalize">{r.status}</span>
                <span className="font-medium">{r.count}</span>
              </li>
            ))}
            {stats.subscriptionBreakdown.length === 0 && (
              <p className="text-muted-foreground">No premium subscribers recorded yet.</p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
