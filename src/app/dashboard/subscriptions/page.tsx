'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOverview } from '@/lib/api';
import type { OverviewStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function SegmentCard({
  title,
  description,
  count,
  href,
  variant = 'default',
}: {
  title: string;
  description: string;
  count: number;
  href: string;
  variant?: 'default' | 'violet';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <p className={`text-3xl font-bold ${variant === 'violet' ? 'text-violet-600' : ''}`}>
          {count.toLocaleString()}
        </p>
        <Link
          href={href}
          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          View list
        </Link>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    fetchOverview().then(setStats);
  }, []);

  if (!stats) return <Skeleton className="h-64 w-full" />;

  const b = stats.premiumBreakdown;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Segments from your database. Use <strong>Paying</strong> for RevenueCat/Play-backed subs;{' '}
          <strong>Manual</strong> for comps or premium you sell outside the store.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Customer segments
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SegmentCard
            title="All premium"
            description="Anyone with premium access in the app (store + manual)."
            count={b.dbFlag}
            href="/dashboard/users?access=premium"
          />
          <SegmentCard
            title="Paying (active store)"
            description="Product id from Play/App + active, cancelled-until-renewal, or grace — closest to RC paying."
            count={b.payingActive}
            href="/dashboard/users?access=paying"
          />
          <SegmentCard
            title="Store / RC on file"
            description="Premium with a store product id (includes lapsed if flag not cleared)."
            count={b.storeBacked}
            href="/dashboard/users?access=store"
          />
          <SegmentCard
            title="Manual / comp"
            description="Premium without a store product — admin grant or offline fee."
            count={b.manualComp}
            href="/dashboard/users?access=manual"
            variant="violet"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Free users</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-3xl font-bold">{stats.freeUsers.toLocaleString()}</p>
            <Link
              href="/dashboard/users?access=free"
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              View list
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premium rate</CardTitle>
            <CardDescription>All premium / all users</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.premiumRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RevenueCat check</CardTitle>
            <CardDescription>Live entitlement sample</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/operations"
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Open operations
            </Link>
          </CardContent>
        </Card>
      </div>

      {(b.stalePeriodEnd > 0 || b.statusExpired > 0) && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Data hygiene</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {b.stalePeriodEnd} users still premium after <code className="rounded bg-muted px-1">premiumUntil</code>{' '}
            passed; {b.statusExpired} marked premium with expired status.{' '}
            <Link href="/dashboard/billing" className="text-primary hover:underline">
              Billing ops → Reconcile stale
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>Among users with isPremium = true</CardDescription>
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
              <p className="text-muted-foreground">No premium users yet.</p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
