'use client';

import Link from 'next/link';
import { formatDistanceStrict } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { fetchGrowth } from '@/lib/api';
import { useAttention, type AttentionItem } from '@/lib/attention';
import { compact, count, pct } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import type { OverviewStats } from '@/lib/types';
import {
  Figure,
  FigureStrip,
  LoadError,
  Notice,
  PageHeader,
  RefreshButton,
  Rows,
  Section,
} from '@/components/console';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

function AttentionRow({ item }: { item: AttentionItem }) {
  const critical = item.tone === 'critical';
  return (
    <li
      className={cn(
        'grid grid-cols-[3px_1fr] sm:grid-cols-[3px_5.5rem_1fr_auto]',
        critical && 'bg-critical-soft/60'
      )}
    >
      <span className={cn(critical ? 'bg-critical' : 'bg-warn')} aria-hidden />
      <div className="hidden items-center px-5 py-4 sm:flex">
        {item.figure != null ? (
          <span className={cn('figure text-[34px]', critical ? 'text-critical' : 'text-warn')}>{compact(item.figure)}</span>
        ) : (
          <TriangleAlert className={cn('size-6', critical ? 'text-critical' : 'text-warn')} aria-label={critical ? 'Critical' : 'Warning'} />
        )}
      </div>
      <div className="min-w-0 px-4 py-4 sm:px-0">
        <p className="text-[15px] font-medium">
          <span className="sm:hidden">{item.figure != null ? `${count(item.figure)} ` : ''}</span>
          {item.title}
        </p>
        {item.detail ? <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.detail}</p> : null}
        <Link href={item.href} className="mt-2 inline-block text-sm font-medium text-primary hover:underline sm:hidden">
          {item.action}
        </Link>
      </div>
      <div className="hidden items-center px-5 sm:flex">
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={item.href} />}>
          {item.action}
        </Button>
      </div>
    </li>
  );
}

function AttentionList() {
  const { items, status, checkedAt, failed } = useAttention();
  const now = useNow();
  const firstLoad = checkedAt === null;

  return (
    <section aria-labelledby="attention-title">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="attention-title" className="text-base font-semibold">
          Needs attention
          {!firstLoad && items.length ? <span className="figure ml-2 text-[19px] text-muted-foreground">{items.length}</span> : null}
        </h2>
        {checkedAt ? (
          <p className="text-[13px] text-muted-foreground">
            Checked {now - checkedAt < 60_000 ? 'just now' : formatDistanceStrict(checkedAt, now, { addSuffix: true })}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {firstLoad ? (
          <Rows n={3} />
        ) : items.length === 0 ? (
          <div className="flex items-start gap-4 px-5 py-6">
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok" />
            <div>
              <p className="text-[15px] font-medium">Nothing needs you right now</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Services are up, backups are current, billing data is consistent and no jobs failed today.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y" aria-busy={status === 'loading'}>
            {items.map((it) => (
              <AttentionRow key={it.id} item={it} />
            ))}
          </ul>
        )}
      </div>
      {failed.length ? (
        <p className="mt-2 text-[13px] text-warn">
          Couldn&apos;t check {failed.join(', ')}. The list may be incomplete.
        </p>
      ) : null}
    </section>
  );
}

function Snapshot({ stats }: { stats: OverviewStats }) {
  const b = stats.premiumBreakdown;
  return (
    <FigureStrip>
      <Figure label="Users" value={count(stats.totalUsers)} note={`${count(stats.signups7d)} joined this week`} />
      <Figure label="Premium" value={count(stats.premiumUsers)} note={`${stats.premiumRate}% of all users`} />
      <Figure label="Paying in store" value={count(b.payingActive)} note="Active Play or App Store period" />
      <Figure label="Manual comps" value={count(b.manualComp)} note="Granted here or paid offline" />
      <Figure label="Expenses this week" value={compact(stats.expenses7d)} note={`${compact(stats.totalExpenses)} all time`} />
      <Figure label="Push devices" value={count(stats.activeDevices)} />
    </FigureStrip>
  );
}

const signupChart = {
  signups: { label: 'Signups', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function SignupsPanel() {
  const growth = useLoad(() => fetchGrowth(30));
  const total = growth.data?.reduce((n, d) => n + d.signups, 0) ?? 0;

  return (
    <Section
      title="Signups, last 30 days"
      actions={
        <Link href="/dashboard/growth" className="text-sm font-medium text-primary hover:underline">
          Growth
        </Link>
      }
    >
      {growth.loading ? (
        <Skeleton className="h-[188px] w-full" />
      ) : growth.error ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load signups. {growth.error}</p>
      ) : (
        <>
          <p className="figure text-[32px]">{count(total)}</p>
          <ChartContainer config={signupChart} className="mt-3 aspect-auto h-[140px] w-full">
            <BarChart data={growth.data ?? []} margin={{ left: 0, right: 0, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="2 4" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(v: string) => v.slice(5)} />
              <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent />} />
              <Bar dataKey="signups" fill="var(--color-signups)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </>
      )}
    </Section>
  );
}

function PremiumMix({ stats }: { stats: OverviewStats }) {
  const b = stats.premiumBreakdown;
  const storeLapsed = Math.max(0, b.storeBacked - b.payingActive);
  const segments = [
    { label: 'Paying in store', n: b.payingActive, color: 'bg-primary', href: '/dashboard/users?access=paying' },
    { label: 'Store, not in period', n: storeLapsed, color: 'bg-chart-2', href: '/dashboard/users?access=store' },
    { label: 'Manual comp', n: b.manualComp, color: 'bg-chart-4', href: '/dashboard/users?access=manual' },
    { label: 'Free', n: stats.freeUsers, color: 'bg-muted-foreground/25', href: '/dashboard/users?access=free' },
  ];
  const total = segments.reduce((n, s) => n + s.n, 0) || 1;

  return (
    <Section
      title="Who has premium"
      actions={
        <Link href="/dashboard/subscriptions" className="text-sm font-medium text-primary hover:underline">
          Subscriptions
        </Link>
      }
    >
      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-muted" role="img" aria-label="Share of users by access type">
        {segments.map((s) =>
          s.n > 0 ? <span key={s.label} className={cn('h-full', s.color)} style={{ width: `${(s.n / total) * 100}%` }} /> : null
        )}
      </div>
      <ul className="mt-4 divide-y">
        {segments.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex items-center gap-3 py-2.5 text-sm hover:text-primary">
              <span className={cn('size-2.5 shrink-0 rounded-[2px]', s.color)} aria-hidden />
              <span className="flex-1">{s.label}</span>
              <span className="num text-muted-foreground">{pct(s.n, total)}</span>
              <span className="num w-14 text-right font-medium">{count(s.n)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {stats.platformBreakdown.length ? (
        <p className="mt-3 border-t pt-3 text-[13px] text-muted-foreground">
          Push devices:{' '}
          {stats.platformBreakdown.map((p, i) => (
            <span key={p.platform}>
              {i ? ', ' : ''}
              <span className="text-foreground">{count(p.count)}</span> {p.platform}
            </span>
          ))}
        </p>
      ) : null}
    </Section>
  );
}

export default function OverviewPage() {
  const { overview, status, refresh, checkedAt, failed } = useAttention();
  const overviewFailed = checkedAt !== null && !overview && failed.includes('user stats');

  return (
    <>
      <PageHeader
        title="Overview"
        description="What needs you right now, then how the product is doing."
        actions={<RefreshButton onClick={() => void refresh()} busy={status === 'loading'} />}
      />

      <div className="space-y-10">
        <AttentionList />

        {overviewFailed ? (
          <LoadError what="user stats" message="The overview endpoint didn't answer." onRetry={() => void refresh()} />
        ) : !overview ? (
          <Skeleton className="h-[104px] w-full rounded-xl" />
        ) : (
          <>
            <Snapshot stats={overview} />
            <div className="grid gap-8 lg:grid-cols-2">
              <SignupsPanel />
              <PremiumMix stats={overview} />
            </div>
            {overview.premiumBreakdown.noPremiumUntil > 0 ? (
              <Notice tone="teal" title={`${count(overview.premiumBreakdown.noPremiumUntil)} premium users have no end date`}>
                Usually lifetime comps. They keep premium until someone revokes it.
              </Notice>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
