'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAttention } from '@/lib/attention';
import { count, humanize, pct } from '@/lib/format';
import {
  Empty,
  Figure,
  FigureStrip,
  LoadError,
  Notice,
  PageHeader,
  RefreshButton,
  Section,
} from '@/components/console';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SubscriptionsPage() {
  const { overview: stats, status, refresh, checkedAt, failed } = useAttention();
  const statsFailed = checkedAt !== null && !stats && failed.includes('user stats');

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Who has premium and how they got it. Paying users come through the store. Manual premium is granted in this console or paid offline."
        actions={<RefreshButton onClick={() => void refresh()} busy={status === 'loading'} />}
      />

      {statsFailed ? (
        <LoadError what="subscription numbers" message="The overview endpoint didn't answer." onRetry={() => void refresh()} />
      ) : !stats ? (
        <div className="space-y-8">
          <Skeleton className="h-[104px] w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <SubscriptionsBody />
      )}
    </>
  );
}

function SubscriptionsBody() {
  const stats = useAttention((s) => s.overview)!;
  const b = stats.premiumBreakdown;
  const stale = b.stalePeriodEnd + b.statusExpired;

  const segments = [
    {
      title: 'Paying',
      definition: 'Store subscription inside its paid period, including cancelled subscriptions until the period ends and grace periods. Closest to RevenueCat’s active count.',
      n: b.payingActive,
      href: '/dashboard/users?access=paying',
    },
    {
      title: 'Store on file',
      definition: 'Premium with a Play or App Store product. Includes lapsed periods that haven’t been cleared yet.',
      n: b.storeBacked,
      href: '/dashboard/users?access=store',
    },
    {
      title: 'Manual',
      definition: 'Premium without a store product: comps granted here and offline payments.',
      n: b.manualComp,
      href: '/dashboard/users?access=manual',
    },
    {
      title: 'Free',
      definition: 'No premium access.',
      n: stats.freeUsers,
      href: '/dashboard/users?access=free',
    },
  ];
  const statusTotal = stats.subscriptionBreakdown.reduce((n, r) => n + r.count, 0);

  return (
    <div className="space-y-12">
      <FigureStrip>
        <Figure label="Premium users" value={count(stats.premiumUsers)} note={`${stats.premiumRate}% of ${count(stats.totalUsers)} users`} size="lg" />
        <Figure label="Paying" value={count(b.payingActive)} note={pct(b.payingActive, stats.premiumUsers) + ' of premium'} size="lg" />
        <Figure label="Manual" value={count(b.manualComp)} note={pct(b.manualComp, stats.premiumUsers) + ' of premium'} size="lg" />
        <Figure label="No end date" value={count(b.noPremiumUntil)} note="Lifetime until revoked" size="lg" />
      </FigureStrip>

      {stale > 0 ? (
        <Notice
          title={`${count(stale)} users still have premium after it ended`}
          action={
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/billing" />}>
              Review in billing
            </Button>
          }
        >
          {count(b.stalePeriodEnd)} are past their end date and {count(b.statusExpired)} are marked expired.
        </Notice>
      ) : null}

      <Section title="Segments" description="Open a segment to see its users." flush>
        <ul className="divide-y">
          {segments.map((s) => (
            <li key={s.title}>
              <Link href={s.href} className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-muted/40 sm:grid-cols-[1fr_7rem_auto]">
                <span className="min-w-0">
                  <span className="block font-medium group-hover:text-primary">{s.title}</span>
                  <span className="block max-w-[60ch] text-sm text-muted-foreground">{s.definition}</span>
                </span>
                <span className="figure text-right text-[28px]">{count(s.n)}</span>
                <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Premium users by status" description="The subscription status stored on each premium account." flush>
        {stats.subscriptionBreakdown.length === 0 ? (
          <Empty title="No premium users yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="w-1/2">Share</TableHead>
                <TableHead className="text-right">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...stats.subscriptionBreakdown]
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <TableRow key={r.status}>
                    <TableCell className="font-medium">{r.status ? humanize(r.status) : 'No status'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / (statusTotal || 1)) * 100}%` }} />
                        </span>
                        <span className="num w-10 text-right text-muted-foreground">{pct(r.count, statusTotal)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">{count(r.count)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
