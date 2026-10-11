'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchTopAiUsers } from '@/lib/api';
import type { TopAiUsersPeriod, TopAiUsersResponse, TopAiUsersSort } from '@/lib/types';
import { kindLabel, usd } from '@/components/user-ai-cost';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

type Row = TopAiUsersResponse['rows'][number];

function signedUsd(n: number): string {
  return n < 0 ? `−${usd(-n)}` : usd(n);
}

function FlagBadge({ row, threshold }: { row: Row; threshold: number }) {
  if (row.flag === 'cost_exceeds_revenue') {
    return (
      <Badge variant="destructive" title="AI cost in this period is higher than what they paid">
        Costs more than pays
      </Badge>
    );
  }
  if (row.flag === 'free_high_cost') {
    return (
      <Badge variant="destructive" title={`Free user at or over ${usd(threshold)} AI cost this month`}>
        Free · high cost
      </Badge>
    );
  }
  return null;
}

/** Heaviest AI users with their AI cost against subscription revenue. */
export function TopAiUsers() {
  const [period, setPeriod] = useState<TopAiUsersPeriod>('month');
  const [sort, setSort] = useState<TopAiUsersSort>('cost');
  const [data, setData] = useState<TopAiUsersResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const key = `${period}:${sort}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    fetchTopAiUsers(period, sort)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(false);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setError(true);
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [period, sort, key]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Top AI users</CardTitle>
          <CardDescription>
            Gemini usage per user against what they paid. AI cost is estimated at paid-tier list price.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as TopAiUsersPeriod)}>
            <TabsList>
              <TabsTrigger value="month">This month</TabsTrigger>
              <TabsTrigger value="prev_month">Last month</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={sort} onValueChange={(v) => setSort(v as TopAiUsersSort)}>
            <TabsList>
              <TabsTrigger value="cost">By cost</TabsTrigger>
              <TabsTrigger value="tokens">By tokens</TabsTrigger>
              <TabsTrigger value="margin">By margin</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : error || !data ? (
          <p className="text-sm text-destructive">Could not load AI usage per user.</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No user-attributed AI usage in this period.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                AI cost <strong className="tabular-nums">{usd(data.summary.aiCostUsd)}</strong>
              </span>
              <span>
                Revenue <strong className="tabular-nums">{usd(data.summary.revenueUsd)}</strong>
              </span>
              <span>
                Margin{' '}
                <strong className="tabular-nums">
                  {signedUsd(data.summary.revenueUsd - data.summary.aiCostUsd)}
                </strong>
              </span>
              <span>
                Flagged{' '}
                <strong className={data.summary.flagged > 0 ? 'text-destructive' : undefined}>
                  {data.summary.flagged}
                </strong>{' '}
                of {data.summary.users} users
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Tokens (in / out)</TableHead>
                    <TableHead className="text-right">AI cost</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    {data.period !== 'all' && <TableHead>Top feature</TableHead>}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r, i) => (
                    <TableRow key={r.userId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        {r.user ? (
                          <Link href={`/dashboard/users/${r.userId}`} className="hover:underline">
                            <span className="font-medium">{r.user.email}</span>
                            {r.user.isPremium && (
                              <Badge variant="secondary" className="ml-2">
                                Premium
                              </Badge>
                            )}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Deleted account · {r.userId.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.calls.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">{compact.format(r.tokens)}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          ({compact.format(r.inputTokens)} / {compact.format(r.outputTokens)})
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{usd(r.costUsd)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.revenueUsd !== 0 ? signedUsd(r.revenueUsd) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${r.marginUsd < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {signedUsd(r.marginUsd)}
                      </TableCell>
                      {data.period !== 'all' && (
                        <TableCell className="text-sm">{r.topKind ? kindLabel(r.topKind) : '—'}</TableCell>
                      )}
                      <TableCell>
                        <FlagBadge row={r} threshold={data.freeUserThresholdUsd} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Totals cover every user with AI usage in the period, not just the rows shown. Revenue is net production
              RevenueCat charges minus refunds received in the period; subscriptions billed before revenue capture show
              as —. Free users are flagged at {usd(data.freeUserThresholdUsd)}+ AI cost per
              month (<code>ALERT_FREE_USER_AI_USD</code>).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
