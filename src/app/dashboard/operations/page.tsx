'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchAiUsage,
  fetchQueueMonitor,
  fetchRagHealth,
  fetchRevenueCatSync,
} from '@/lib/api';
import type {
  AiUsageResponse,
  QueueMonitorResponse,
  RagHealthResponse,
  RevenueCatSyncResponse,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

const chartConfig = {
  total: { label: 'AI calls', color: 'hsl(var(--chart-1))' },
  fallbacks: { label: 'Model fallbacks', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ');
}

export default function OperationsPage() {
  const [days, setDays] = useState(30);
  const [ai, setAi] = useState<AiUsageResponse | null>(null);
  const [loadedAiDays, setLoadedAiDays] = useState<number | null>(null);
  const aiLoading = loadedAiDays !== days;
  const [queues, setQueues] = useState<QueueMonitorResponse | null>(null);
  const [rag, setRag] = useState<RagHealthResponse | null>(null);
  const [rc, setRc] = useState<RevenueCatSyncResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiUsage(days)
      .then((usage) => {
        if (cancelled) return;
        setAi(usage);
        setLoadedAiDays(days);
      })
      .catch(() => {
        if (cancelled) return;
        setAi(null);
        setLoadedAiDays(days);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    fetchQueueMonitor().then(setQueues).catch(() => setQueues(null));
    fetchRagHealth().then(setRag).catch(() => setRag(null));
    fetchRevenueCatSync().then(setRc).catch(() => setRc(null));
  }, []);

  const chartData = useMemo(() => {
    if (!ai) return [];
    return ai.series.map((row) => ({
      date: row.date,
      total: row.total,
      fallbacks: ai.fallbacks[row.date] ?? 0,
    }));
  }, [ai]);

  const topKinds = useMemo(() => {
    if (!ai) return [];
    return Object.entries(ai.totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [ai]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground">
            AI usage, job queues, RAG health, and RevenueCat vs database premium checks.
          </p>
        </div>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">AI 7d</TabsTrigger>
            <TabsTrigger value="30">AI 30d</TabsTrigger>
            <TabsTrigger value="90">AI 90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI usage</CardTitle>
          <CardDescription>
            Redis counters incremented on each Gemini call (parse, insights, advisor, embeddings, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiLoading || !ai ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="total" fill="var(--color-total)" stroke="var(--color-total)" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="fallbacks" fill="var(--color-fallbacks)" stroke="var(--color-fallbacks)" fillOpacity={0.15} />
                </AreaChart>
              </ChartContainer>
              {topKinds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topKinds.map(([kind, count]) => (
                    <Badge key={kind} variant="secondary">
                      {kindLabel(kind)}: {count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No AI usage recorded yet in this window.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>BullMQ queues</CardTitle>
            <CardDescription>Expense parse, category budgets, weekly briefing, recurring sweep.</CardDescription>
          </CardHeader>
          <CardContent>
            {!queues ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="space-y-4">
                {queues.queues.map((q) => (
                  <div key={q.name} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{q.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      waiting {q.counts.waiting} · active {q.counts.active} · failed {q.counts.failed} · delayed{' '}
                      {q.counts.delayed}
                    </p>
                    {q.recentFailed.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-xs text-destructive">
                        {q.recentFailed.slice(0, 3).map((f) => (
                          <li key={f.id} className="truncate">
                            {f.failedReason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RAG &amp; embeddings</CardTitle>
            <CardDescription>Postgres vector rows vs Pinecone index stats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!rag ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <p>
                  Expenses: <strong>{rag.postgres.expenses}</strong> · Vector rows:{' '}
                  <strong>{rag.postgres.vectorRows}</strong> · Users with embeddings:{' '}
                  <strong>{rag.postgres.usersWithEmbeddings}</strong>
                </p>
                <p className="text-muted-foreground">
                  Missing embedding estimate: {rag.postgres.missingEmbeddingsEstimate}
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  Pinecone ({rag.pinecone.indexName}):{' '}
                  {rag.pinecone.ready ? (
                    <Badge variant="default">connected</Badge>
                  ) : (
                    <Badge variant="destructive">unavailable</Badge>
                  )}
                  {rag.pinecone.totalVectors != null && (
                    <span className="text-muted-foreground">
                      {rag.pinecone.totalVectors} vectors
                      {rag.pinecone.dimension != null ? ` · dim ${rag.pinecone.dimension}` : ''}
                    </span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RevenueCat vs database</CardTitle>
          <CardDescription>
            Checks all DB premium users (up to 200) and compares <code className="rounded bg-muted px-1">isPremium</code>{' '}
            to the configured entitlement. Requires <code className="rounded bg-muted px-1">REVENUECAT_SECRET_API_KEY</code>{' '}
            on the API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!rc ? (
            <Skeleton className="h-24 w-full" />
          ) : !rc.configured ? (
            <p className="text-sm text-muted-foreground">{rc.message}</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Entitlement <strong>{rc.entitlementId}</strong> · DB premium{' '}
                <strong>{rc.dbPremiumCount}</strong> · checked {rc.sampled} · RC active in check{' '}
                <strong>{rc.rcActiveInSample}</strong> (compare to RevenueCat “Active subscriptions”) · mismatches{' '}
                <strong>{rc.mismatchCount}</strong>
              </p>
              {rc.mismatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mismatches in this sample.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>DB</TableHead>
                        <TableHead>RevenueCat</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rc.mismatches.map((m) => (
                        <TableRow key={m.userId}>
                          <TableCell className="font-medium">{m.email}</TableCell>
                          <TableCell>{m.dbPremium ? 'Premium' : 'Free'}</TableCell>
                          <TableCell>{m.rcPremium ? 'Active' : 'Inactive'}</TableCell>
                          <TableCell className="max-w-xs text-sm">{m.reason}</TableCell>
                          <TableCell>
                            <Link href={`/dashboard/users/${m.userId}`} className="text-sm text-primary hover:underline">
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
