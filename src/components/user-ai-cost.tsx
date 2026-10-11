'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { fetchUserAiUsage } from '@/lib/api';
import type { AiUsageStats, UserAiUsageResponse } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const chartConfig = {
  costUsd: { label: 'Cost', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const KIND_LABELS: Record<string, string> = {
  parse: 'Expense parsing',
  parse_async: 'Expense parsing (background)',
  ocr: 'Receipt / document OCR',
  insights: 'Insights',
  briefing: 'Weekly briefing',
  advisor_ask: 'Advisor — ask',
  advisor_why: 'Advisor — why',
  advisor_savings: 'Advisor — savings',
  search: 'Smart search',
  embedding: 'Embeddings (RAG)',
  budget_category: 'Budget parsing',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

/** AI costs per user are fractions of a cent, so show enough precision to be useful. */
export function usd(n: number): string {
  if (!n) return '$0.00';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n < 0.000001) return '<$0.000001';
  return `$${n.toFixed(6).replace(/0+$/, '')}`;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function pct(part: number, whole: number): string {
  if (!whole) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

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
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameHeader}</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Input tok.</TableHead>
            <TableHead className="text-right">Output tok.</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Share</TableHead>
            <TableHead className="text-right">Per call</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([name, s]) => (
            <TableRow key={name}>
              <TableCell>{renderName(name, s)}</TableCell>
              <TableCell className="text-right tabular-nums">{s.calls.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{compact.format(s.inputTokens)}</TableCell>
              <TableCell className="text-right tabular-nums">{compact.format(s.outputTokens)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{usd(s.costUsd)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {pct(s.costUsd, totalCost)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {s.calls ? usd(s.costUsd / s.calls) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function UserAiCost({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UserAiUsageResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const key = `${userId}:${refreshKey}:${days}`;

  useEffect(() => {
    let cancelled = false;
    fetchUserAiUsage(userId, days)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, days, key]);

  const loading = loadedKey !== key;

  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">AI cost</h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            {data?.note ?? 'Estimated Gemini spend for this user, per feature and per model.'}
          </p>
        </div>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
            <Skeleton className="h-[200px] w-full" />
          </>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Could not load AI cost.</p>
        ) : (
          <CostBody data={data} />
        )}
      </div>
    </section>
  );
}

function CostBody({ data }: { data: UserAiUsageResponse }) {
  const { totals, lifetime, days } = data;
  const kinds = Object.entries(data.byKind).sort(([, a], [, b]) => b.costUsd - a.costUsd);
  const models = Object.entries(data.byModel).sort(([, a], [, b]) => b.costUsd - a.costUsd);
  const topKind = kinds[0];
  const monthly = (totals.costUsd / days) * 30;

  if (totals.calls === 0 && !lifetime?.calls) {
    return (
      <p className="text-sm text-muted-foreground">
        No AI calls recorded for this user in the last {days} days.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Cost · last ${days}d`}
          value={usd(totals.costUsd)}
          hint={`${totals.calls.toLocaleString()} calls · ${compact.format(totals.tokens)} tokens`}
        />
        <Kpi
          label="Projected / month"
          value={usd(monthly)}
          hint={`at the ${days}-day pace`}
        />
        <Kpi
          label="Avg per call"
          value={totals.calls ? usd(totals.costUsd / totals.calls) : '—'}
          hint={
            totals.activeDays
              ? `${usd(totals.costUsd / totals.activeDays)} per active day (${totals.activeDays}d)`
              : undefined
          }
        />
        <Kpi
          label="Lifetime cost"
          value={lifetime ? usd(lifetime.costUsd) : '—'}
          hint={
            lifetime?.since
              ? `${lifetime.calls.toLocaleString()} calls since ${format(new Date(lifetime.since), 'MMM d, yyyy')}`
              : 'Tracked from cost-tracking deploy'
          }
        />
      </div>

      {topKind && totals.costUsd > 0 ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Top cost driver: </span>
          <span className="font-medium">{kindLabel(topKind[0])}</span>
          <span className="text-muted-foreground">
            {' '}
            — {pct(topKind[1].costUsd, totals.costUsd)} of spend over {topKind[1].calls.toLocaleString()} calls.
            Output tokens make up {pct(totals.outputTokens, totals.tokens)} of volume.
          </span>
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Daily cost</p>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data.series} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => usd(v)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">
                        {item.payload.totalCalls.toLocaleString()} calls
                      </span>
                      <span className="font-mono font-medium tabular-nums">{usd(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="costUsd" fill="var(--color-costUsd)" radius={3} />
          </BarChart>
        </ChartContainer>
      </div>

      {kinds.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">By feature</p>
          <UsageTable
            rows={kinds}
            totalCost={totals.costUsd}
            nameHeader="Feature"
            renderName={(k) => <span className="text-sm">{kindLabel(k)}</span>}
          />
        </div>
      ) : null}

      {models.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">By model</p>
          <UsageTable
            rows={models}
            totalCost={totals.costUsd}
            nameHeader="Model"
            renderName={(m, s) => (
              <span className="flex items-center gap-2 font-mono text-xs">
                {m}
                {s.priced === false ? (
                  <Badge variant="outline" className="font-sans">
                    no price — estimated high
                  </Badge>
                ) : data.pricing[m] ? (
                  <span className="font-sans text-muted-foreground">
                    ${data.pricing[m].input}/${data.pricing[m].output} per 1M
                  </span>
                ) : null}
              </span>
            )}
          />
        </div>
      ) : null}

      {data.monthly?.some((m) => m.calls > 0) ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Monthly history</p>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
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
                      <TableCell>{format(new Date(`${m.month}-01T00:00:00`), 'MMM yyyy')}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.calls.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{usd(m.costUsd)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {totals.legacyCostUsd > 0 ? (
        <p className="text-xs text-muted-foreground">
          {usd(totals.legacyCostUsd)} of this window is estimated from older records that only stored total
          tokens (assumed 85% input / 15% output; not attributed to a model).
        </p>
      ) : null}
    </>
  );
}
