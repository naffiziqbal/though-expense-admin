'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fetchTopAiUsers } from '@/lib/api';
import { aiKindLabel, compact, count, usd } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { TopAiUsersPeriod, TopAiUsersResponse, TopAiUsersSort } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Empty, Figure, LoadError, Rows, Section, Tag } from '@/components/console';
import { RangeTabs } from '@/components/range-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = TopAiUsersResponse['rows'][number];

const PERIOD_LABEL: Record<TopAiUsersPeriod, string> = { month: 'This month', prev_month: 'Last month', all: 'All time' };
const SORT_LABEL: Record<TopAiUsersSort, string> = { cost: 'Highest cost', tokens: 'Most tokens', margin: 'Lowest margin' };

function FlagTag({ row, threshold }: { row: Row; threshold: number }) {
  if (row.flag === 'cost_exceeds_revenue') {
    return <Tag tone="critical" title="Their AI cost this period is higher than what they paid">Costs more than they pay</Tag>;
  }
  if (row.flag === 'free_high_cost') {
    return <Tag tone="warn" title={`Free user at or over ${usd(threshold)} of AI this month`}>Free, high cost</Tag>;
  }
  return null;
}

/** Heaviest AI users, with their AI cost set against what they paid. */
export function TopAiUsers() {
  const [period, setPeriod] = useState<TopAiUsersPeriod>('month');
  const [sort, setSort] = useState<TopAiUsersSort>('cost');
  const res = useLoad(() => fetchTopAiUsers(period, sort), `${period}:${sort}`);
  const data = res.data;

  return (
    <Section
      id="ai-users"
      title="AI cost per user"
      description="Gemini spend per user at paid-tier list price, against the net revenue they brought in."
      flush
      actions={
        <>
          <RangeTabs value={period} onChange={setPeriod} options={['month', 'prev_month', 'all'] as TopAiUsersPeriod[]} label={(v) => PERIOD_LABEL[v]} ariaLabel="Period" />
          <RangeTabs value={sort} onChange={setSort} options={['cost', 'tokens', 'margin'] as TopAiUsersSort[]} label={(v) => SORT_LABEL[v]} ariaLabel="Sort by" />
        </>
      }
    >
      {res.loading ? (
        <Rows n={6} />
      ) : res.error || !data ? (
        <div className="p-5">
          <LoadError what="AI cost per user" message={res.error ?? ''} onRetry={res.reload} />
        </div>
      ) : data.rows.length === 0 ? (
        <Empty title="No AI usage tied to a user in this period" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-b px-5 py-5 lg:grid-cols-4">
            <Figure label="AI cost" value={usd(data.summary.aiCostUsd)} note={`${count(data.summary.users)} users`} />
            <Figure label="Revenue" value={usd(data.summary.revenueUsd)} note="Net of refunds" />
            <Figure
              label="Margin"
              value={usd(data.summary.revenueUsd - data.summary.aiCostUsd)}
              tone={data.summary.revenueUsd - data.summary.aiCostUsd < 0 ? 'critical' : undefined}
            />
            <Figure
              label="Flagged users"
              value={count(data.summary.flagged)}
              tone={data.summary.flagged > 0 ? 'warn' : undefined}
              note={`Free users flag at ${usd(data.freeUserThresholdUsd)} a month`}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="hidden text-right md:table-cell">Tokens</TableHead>
                <TableHead className="text-right">AI cost</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Revenue</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                {data.period !== 'all' ? <TableHead className="hidden lg:table-cell">Top feature</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="max-w-[18rem]">
                    {r.user ? (
                      <Link href={`/dashboard/users/${r.userId}`} className="block truncate font-medium hover:underline">
                        {r.user.email}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Deleted account</span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {r.user?.isPremium ? <Tag tone="teal">Premium</Tag> : r.user ? <Tag>Free</Tag> : null}
                      <FlagTag row={r} threshold={data.freeUserThresholdUsd} />
                    </span>
                  </TableCell>
                  <TableCell className="num text-right">{count(r.calls)}</TableCell>
                  <TableCell className="num hidden text-right md:table-cell">
                    {compact(r.tokens)}
                    <span className="block text-xs text-muted-foreground">
                      {compact(r.inputTokens)} in, {compact(r.outputTokens)} out
                    </span>
                  </TableCell>
                  <TableCell className="num text-right font-medium">{usd(r.costUsd)}</TableCell>
                  <TableCell className="num hidden text-right sm:table-cell">
                    {r.revenueUsd !== 0 ? usd(r.revenueUsd) : <span className="text-muted-foreground">–</span>}
                  </TableCell>
                  <TableCell className={cn('num text-right', r.marginUsd < 0 ? 'font-medium text-critical' : 'text-muted-foreground')}>
                    {usd(r.marginUsd)}
                  </TableCell>
                  {data.period !== 'all' ? (
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{r.topKind ? aiKindLabel(r.topKind) : '–'}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Totals cover every user with AI usage in the period, not only the rows shown. Revenue is net RevenueCat charges minus
            refunds in the period. Subscriptions billed before revenue tracking started show as –.
          </p>
        </>
      )}
    </Section>
  );
}
