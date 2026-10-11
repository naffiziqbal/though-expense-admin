'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { fetchAiUsage, fetchQueueMonitor, fetchRagHealth, fetchRevenueCatSync } from '@/lib/api';
import { aiKindLabel, ago, compact, count, pct, queueLabel } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { RevenueCatSyncResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Empty,
  Field,
  Fields,
  Figure,
  LoadError,
  PageHeader,
  RefreshButton,
  Rows,
  Section,
  Tag,
} from '@/components/console';
import { RangeTabs } from '@/components/range-tabs';
import { TopAiUsers } from '@/components/top-ai-users';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const chartConfig = {
  total: { label: 'AI calls', color: 'var(--chart-1)' },
  fallbacks: { label: 'Fell back to another model', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const JUMP = [
  ['ai', 'AI usage'],
  ['ai-users', 'AI cost per user'],
  ['queues', 'Job queues'],
  ['revenuecat', 'RevenueCat check'],
  ['search', 'Search index'],
] as const;

function AiUsage() {
  const [days, setDays] = useState(30);
  const ai = useLoad(() => fetchAiUsage(days), String(days));

  const chartData = useMemo(
    () => ai.data?.series.map((r) => ({ date: r.date, total: r.total, fallbacks: ai.data?.fallbacks[r.date] ?? 0 })) ?? [],
    [ai.data]
  );
  const kinds = useMemo(() => Object.entries(ai.data?.totals ?? {}).sort((a, b) => b[1] - a[1]), [ai.data]);
  const totalCalls = kinds.reduce((n, [, c]) => n + c, 0);
  const totalFallbacks = Object.values(ai.data?.fallbacks ?? {}).reduce((n, c) => n + c, 0);

  return (
    <Section
      id="ai"
      title="AI usage"
      description="Every Gemini call, counted as it happens: parsing, insights, advisor, embeddings and more."
      actions={<RangeTabs value={days} onChange={setDays} />}
    >
      {ai.loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : ai.error || !ai.data ? (
        <LoadError what="AI usage" message={ai.error ?? ''} onRetry={ai.reload} />
      ) : totalCalls === 0 ? (
        <Empty title={`No AI calls in the last ${days} days`} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <Figure label="Calls" value={compact(totalCalls)} />
              <Figure
                label="Model fallbacks"
                value={count(totalFallbacks)}
                note={`${pct(totalFallbacks, totalCalls)} of calls`}
                tone={totalFallbacks / totalCalls > 0.05 ? 'warn' : undefined}
              />
            </div>
            <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-[200px] w-full">
              <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="2 4" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(v: string) => v.slice(5)} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="total" fill="var(--color-total)" stroke="var(--color-total)" fillOpacity={0.15} strokeWidth={1.75} />
                <Area type="monotone" dataKey="fallbacks" fill="var(--color-fallbacks)" stroke="var(--color-fallbacks)" fillOpacity={0.2} strokeWidth={1.5} />
              </AreaChart>
            </ChartContainer>
          </div>
          <div>
            <p className="mb-3 text-[13px] text-muted-foreground">By feature</p>
            <ul className="space-y-3">
              {kinds.slice(0, 9).map(([kind, n]) => (
                <li key={kind}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{aiKindLabel(kind)}</span>
                    <span className="num text-muted-foreground">{compact(n)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(n / kinds[0][1]) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  );
}

function Queues() {
  const q = useLoad(fetchQueueMonitor);
  const [openQueue, setOpenQueue] = useState<string | null>(null);

  return (
    <Section
      id="queues"
      title="Job queues"
      description="Background work: imports and parsing, budgets, weekly briefings, recurring expenses and the alert monitor."
      flush
      actions={<RefreshButton onClick={q.reload} busy={q.refreshing} />}
    >
      {q.loading ? (
        <Rows n={4} />
      ) : q.error || !q.data ? (
        <div className="p-5">
          <LoadError what="queues" message={q.error ?? ''} onRetry={q.reload} />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead className="text-right">Waiting</TableHead>
              <TableHead className="text-right">Running</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Delayed</TableHead>
              <TableHead className="text-right">Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.queues.map((queue) => {
              const open = openQueue === queue.name;
              return [
                <TableRow key={queue.name}>
                  <TableCell>
                    <span className="font-medium">{queueLabel(queue.name)}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{queue.name}</span>
                  </TableCell>
                  <TableCell className={cn('num text-right', queue.counts.waiting >= 50 && 'font-medium text-warn')}>
                    {count(queue.counts.waiting)}
                  </TableCell>
                  <TableCell className="num text-right">{count(queue.counts.active)}</TableCell>
                  <TableCell className="num hidden text-right sm:table-cell">{count(queue.counts.delayed)}</TableCell>
                  <TableCell className="text-right">
                    {queue.recentFailed.length ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} recent failures`}
                        className="num text-critical"
                        onClick={() => setOpenQueue(open ? null : queue.name)}
                      >
                        {count(queue.counts.failed)}
                        <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                      </Button>
                    ) : (
                      <span className="num text-muted-foreground">{count(queue.counts.failed)}</span>
                    )}
                  </TableCell>
                </TableRow>,
                open ? (
                  <TableRow key={`${queue.name}-failed`} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-muted/30 whitespace-normal">
                      <p className="mb-2 text-[13px] text-muted-foreground">Most recent failures</p>
                      <ul className="space-y-2">
                        {queue.recentFailed.map((f) => (
                          <li key={f.id} className="text-sm">
                            <span className="text-muted-foreground">{ago(new Date(f.timestamp).toISOString())}</span>{' '}
                            <span className="font-medium">{f.name}</span>
                            <span className="block font-mono text-[12px] break-words text-critical">{f.failedReason}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ) : null,
              ];
            })}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function SearchIndex() {
  const rag = useLoad(fetchRagHealth);
  const d = rag.data;
  const coverage = d ? pct(d.postgres.vectorRows, d.postgres.expenses) : '–';

  return (
    <Section id="search" title="Search index" description="Expense embeddings that power smart search and the advisor.">
      {rag.loading ? (
        <Skeleton className="h-36 w-full" />
      ) : rag.error || !d ? (
        <LoadError what="search index" message={rag.error ?? ''} onRetry={rag.reload} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-x-10 gap-y-4">
            <Figure label="Expenses embedded" value={coverage} note={`${count(d.postgres.vectorRows)} of ${count(d.postgres.expenses)}`} />
            <Figure
              label="Missing embeddings"
              value={count(d.postgres.missingEmbeddingsEstimate)}
              tone={d.postgres.missingEmbeddingsEstimate > 0 ? 'warn' : undefined}
              note="Estimate"
            />
          </div>
          <Fields>
            <Field label="Pinecone">
              {d.pinecone.ready ? <Tag tone="ok" dot>Connected</Tag> : <Tag tone="critical" dot>Unavailable</Tag>}
            </Field>
            <Field label="Index" mono>{d.pinecone.indexName}</Field>
            <Field label="Vectors in index">{d.pinecone.totalVectors != null ? count(d.pinecone.totalVectors) : '–'}</Field>
            <Field label="Dimension">{d.pinecone.dimension ?? '–'}</Field>
            <Field label="Users with embeddings">{count(d.postgres.usersWithEmbeddings)}</Field>
          </Fields>
        </>
      )}
    </Section>
  );
}

function RevenueCatCheck() {
  const [result, setResult] = useState<RevenueCatSyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setResult(await fetchRevenueCatSync());
    } catch {
      setError('RevenueCat or the API did not answer.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Section
      id="revenuecat"
      title="RevenueCat check"
      description="Compares premium in our database with the live RevenueCat entitlement for up to 200 premium users. It calls RevenueCat once per user, so it runs only when you ask."
      flush
      actions={
        <Button variant={result ? 'outline' : 'default'} size="sm" onClick={() => void run()} disabled={running}>
          {running ? 'Checking…' : result ? 'Check again' : 'Run check'}
        </Button>
      }
    >
      {error ? (
        <div className="p-5">
          <LoadError what="the RevenueCat check" message={error} onRetry={() => void run()} />
        </div>
      ) : running && !result ? (
        <Rows n={3} />
      ) : !result ? (
        <Empty title="Not run yet">Run it after a billing incident, or when RevenueCat&apos;s active subscriber count looks off.</Empty>
      ) : !result.configured ? (
        <Empty title="RevenueCat isn't connected">{result.message}</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-b px-5 py-5 lg:grid-cols-4">
            <Figure label="Premium in database" value={count(result.dbPremiumCount)} />
            <Figure label="Checked" value={count(result.sampled)} note={`Entitlement ${result.entitlementId}`} />
            <Figure label="Active in RevenueCat" value={count(result.rcActiveInSample)} note="Compare with the RevenueCat dashboard" />
            <Figure label="Mismatches" value={count(result.mismatchCount)} tone={result.mismatchCount ? 'warn' : 'ok'} />
          </div>
          {result.mismatches.length === 0 ? (
            <Empty title="Everything matches">Every checked user has the same premium state in both places.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>RevenueCat</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.mismatches.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <Link href={`/dashboard/users/${m.userId}`} className="font-medium hover:underline">
                        {m.email}
                      </Link>
                    </TableCell>
                    <TableCell>{m.dbPremium ? <Tag tone="teal">Premium</Tag> : <Tag>Free</Tag>}</TableCell>
                    <TableCell>{m.rcPremium ? <Tag tone="teal">Active</Tag> : <Tag>Inactive</Tag>}</TableCell>
                    <TableCell className="max-w-sm whitespace-normal text-muted-foreground">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Section>
  );
}

export default function OperationsPage() {
  return (
    <>
      <PageHeader title="Operations" description="How the AI, background jobs, search index and billing integration are running.">
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {JUMP.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </PageHeader>
      <div className="space-y-12">
        <AiUsage />
        <TopAiUsers />
        <Queues />
        <RevenueCatCheck />
        <SearchIndex />
      </div>
    </>
  );
}
