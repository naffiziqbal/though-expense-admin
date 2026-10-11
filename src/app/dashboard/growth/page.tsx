'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { fetchGrowth } from '@/lib/api';
import { count } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { Empty, Figure, FigureStrip, LoadError, PageHeader, Section } from '@/components/console';
import { RangeTabs } from '@/components/range-tabs';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
  free: { label: 'Free', color: 'var(--chart-2)' },
  premium: { label: 'Premium at signup', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function change(cur: number, prev: number | null): string | undefined {
  if (prev == null) return undefined;
  if (prev === 0) return cur === 0 ? 'Same as the period before' : 'None in the period before';
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return 'Same as the period before';
  return `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)}% on the period before`;
}

export default function GrowthPage() {
  const [days, setDays] = useState(30);
  // Fetch twice the window (API max is 90 days) so we can compare with the previous period.
  const span = Math.min(90, days * 2);
  const growth = useLoad(() => fetchGrowth(span), String(span));

  const view = useMemo(() => {
    if (!growth.data) return null;
    const rows = growth.data;
    const current = rows.slice(-days);
    const previous = rows.length >= days * 2 ? rows.slice(-days * 2, -days) : null;
    const sum = (r: typeof rows, k: 'signups' | 'premiumSignups') => r.reduce((n, d) => n + d[k], 0);
    return {
      chart: current.map((d) => ({ date: d.date, free: d.signups - d.premiumSignups, premium: d.premiumSignups })),
      signups: sum(current, 'signups'),
      premium: sum(current, 'premiumSignups'),
      prevSignups: previous ? sum(previous, 'signups') : null,
      best: current.reduce((m, d) => (d.signups > m.signups ? d : m), current[0]),
    };
  }, [growth.data, days]);

  return (
    <>
      <PageHeader
        title="Growth"
        description="New accounts per day. Premium at signup counts people who registered with premium already on, such as through a promo."
        actions={<RangeTabs value={days} onChange={setDays} />}
      />

      {growth.loading || (!view && !growth.error) ? (
        <div className="space-y-8">
          <Skeleton className="h-[104px] w-full rounded-xl" />
          <Skeleton className="h-[360px] w-full rounded-xl" />
        </div>
      ) : growth.error || !view ? (
        <LoadError what="signups" message={growth.error ?? ''} onRetry={growth.reload} />
      ) : (
        <div className="space-y-10">
          <FigureStrip>
            <Figure label={`Signups, last ${days} days`} value={count(view.signups)} note={change(view.signups, view.prevSignups)} size="lg" />
            <Figure label="Per day" value={(view.signups / days).toFixed(1)} size="lg" />
            <Figure label="Premium at signup" value={count(view.premium)} size="lg" />
            <Figure
              label="Best day"
              value={view.best && view.best.signups > 0 ? count(view.best.signups) : '–'}
              note={view.best && view.best.signups > 0 ? format(new Date(`${view.best.date}T00:00:00`), 'EEE, MMM d') : undefined}
              size="lg"
            />
          </FigureStrip>

          <Section title="Daily signups">
            {view.signups === 0 ? (
              <Empty title={`No signups in the last ${days} days`} />
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
                <BarChart data={view.chart} margin={{ left: 0, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={(v: string) => format(new Date(`${v}T00:00:00`), 'MMM d')}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="free" stackId="s" fill="var(--color-free)" />
                  <Bar dataKey="premium" stackId="s" fill="var(--color-premium)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
