'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { fetchUserAiUsage } from '@/lib/api';
import { aiKindLabel, compact, count, pct, usd } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { AiUsageStats, UserAiUsageResponse } from '@/lib/types';
import { Empty, Figure, LoadError, Section, Tag } from '@/components/console';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RangeTabs } from '@/components/range-tabs';

const chartConfig = {
  costUsd: { label: 'Cost', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function UsageTable({
  rows,
  totalCost,
  nameHeader,
  renderName,
}: {
  rows: Array<[string, AiUsageStats & { priced?: boolean }]>;
  totalCost: number;
  nameHeader: string;
  renderName: (name: string, stats: AiUsageStats & { priced?: boolean }) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{nameHeader}</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Tokens in</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Tokens out</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([name, s]) => (
          <TableRow key={name}>
            <TableCell>{renderName(name, s)}</TableCell>
            <TableCell className="num text-right">{count(s.calls)}</TableCell>
            <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">{compact(s.inputTokens)}</TableCell>
            <TableCell className="num hidden text-right text-muted-foreground sm:table-cell">{compact(s.outputTokens)}</TableCell>
            <TableCell className="num text-right font-medium">{usd(s.costUsd)}</TableCell>
            <TableCell className="num text-right text-muted-foreground">{pct(s.costUsd, totalCost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Estimated Gemini spend for one user. */
export function UserAiCost({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [days, setDays] = useState(30);
  const usage = useLoad(() => fetchUserAiUsage(userId, days), `${userId}:${refreshKey}:${days}`);

  return (
    <Section
      title="AI cost"
      description={usage.data?.note ?? 'Estimated Gemini spend for this user at paid-tier list price.'}
      actions={<RangeTabs value={days} onChange={setDays} />}
    >
      {usage.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[180px] w-full" />
        </div>
      ) : usage.error || !usage.data ? (
        <LoadError what="AI cost" message={usage.error ?? ''} onRetry={usage.reload} />
      ) : (
        <CostBody data={usage.data} />
      )}
    </Section>
  );
}

function CostBody({ data }: { data: UserAiUsageResponse }) {
  const { totals, lifetime, days } = data;
  const kinds = Object.entries(data.byKind).sort(([, a], [, b]) => b.costUsd - a.costUsd);
  const models = Object.entries(data.byModel).sort(([, a], [, b]) => b.costUsd - a.costUsd);
  const top = kinds[0];
  const monthly = (totals.costUsd / days) * 30;

  if (totals.calls === 0 && !lifetime?.calls) {
    return <Empty title={`No AI calls in the last ${days} days`}>This user hasn&apos;t used parsing, insights or the advisor in this window.</Empty>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Figure label={`Last ${days} days`} value={usd(totals.costUsd)} note={`${count(totals.calls)} calls`} />
        <Figure label="Per month at this pace" value={usd(monthly)} />
        <Figure
          label="Per call"
          value={totals.calls ? usd(totals.costUsd / totals.calls) : '–'}
          note={totals.activeDays ? `${totals.activeDays} active days` : undefined}
        />
        <Figure
          label="Lifetime"
          value={lifetime ? usd(lifetime.costUsd) : '–'}
          note={lifetime?.since ? `Since ${format(new Date(lifetime.since), 'MMM d, yyyy')}` : 'Tracked since cost tracking shipped'}
        />
      </div>

      {top && totals.costUsd > 0 ? (
        <p className="text-sm">
          <span className="font-medium">{aiKindLabel(top[0])}</span>{' '}
          <span className="text-muted-foreground">
            drives {pct(top[1].costUsd, totals.costUsd)} of this user&apos;s AI cost. Output tokens are {pct(totals.outputTokens, totals.tokens)} of volume.
          </span>
        </p>
      ) : null}

      <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
        <BarChart data={data.series} margin={{ left: 0, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => usd(v)} />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)' }}
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">{count(item.payload.totalCalls)} calls</span>
                    <span className="num font-medium">{usd(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="costUsd" fill="var(--color-costUsd)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>

      {kinds.length > 0 ? (
        <div className="-mx-5 border-t">
          <UsageTable rows={kinds} totalCost={totals.costUsd} nameHeader="Feature" renderName={(k) => aiKindLabel(k)} />
        </div>
      ) : null}

      {models.length > 0 ? (
        <div className="-mx-5 border-t">
          <UsageTable
            rows={models}
            totalCost={totals.costUsd}
            nameHeader="Model"
            renderName={(m, s) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px]">{m}</span>
                {s.priced === false ? (
                  <Tag tone="warn" title="No list price on file, so the estimate uses a high fallback">No price on file</Tag>
                ) : data.pricing[m] ? (
                  <span className="text-xs text-muted-foreground">
                    ${data.pricing[m].input} in, ${data.pricing[m].output} out per 1M
                  </span>
                ) : null}
              </span>
            )}
          />
        </div>
      ) : null}

      {data.monthly?.some((m) => m.calls > 0) ? (
        <div className="-mx-5 -mb-5 border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.monthly
                .filter((m) => m.calls > 0)
                .reverse()
                .map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{format(new Date(`${m.month}-01T00:00:00`), 'MMMM yyyy')}</TableCell>
                    <TableCell className="num text-right">{count(m.calls)}</TableCell>
                    <TableCell className="num text-right font-medium">{usd(m.costUsd)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {totals.legacyCostUsd > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {usd(totals.legacyCostUsd)} of this window comes from older records that only stored total tokens. It assumes 85% input
          and 15% output and isn&apos;t tied to a model.
        </p>
      ) : null}
    </div>
  );
}
