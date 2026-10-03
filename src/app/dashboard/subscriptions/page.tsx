'use client';

import { useEffect, useState } from 'react';
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

  const mrrHint =
    'Revenue lives in RevenueCat / Play Console. This panel tracks subscriber counts from your database (webhook-synced).';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">{mrrHint}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paying users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.premiumUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Free users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.freeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.premiumRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>active · cancelled · grace · expired (from RevenueCat webhooks)</CardDescription>
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
