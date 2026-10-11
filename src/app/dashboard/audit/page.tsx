'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchAuditLogs } from '@/lib/api';
import {
  auditActionLabel,
  auditActionTone,
  auditFilterLabel,
  formatAuditDetailsSummary,
  formatAuditUser,
  AUDIT_ACTION_FILTERS,
} from '@/lib/audit-format';
import { dateTime, shortTime } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { Empty, LoadError, PageHeader, Pager, RefreshButton, Rows, Tag } from '@/components/console';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const LIMIT = 30;

function AuditContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = AUDIT_ACTION_FILTERS.includes(params.get('action') ?? '') ? (params.get('action') as string) : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const logs = useLoad(() => fetchAuditLogs(page, action), `${page}|${action}`);

  function setParams(next: { action?: string; page?: number }) {
    const p = new URLSearchParams(params.toString());
    if (next.action !== undefined) {
      if (next.action === 'all') p.delete('action');
      else p.set('action', next.action);
    }
    if (next.page && next.page > 1) p.set('page', String(next.page));
    else p.delete('page');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Guard for an API that predates the action filter: never show rows that don't match.
  const rows = logs.data?.items.filter((r) => action === 'all' || r.action === action) ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change made from this console: premium grants and revokes, moderation, sign-outs, billing clean-ups and backup downloads."
        actions={
          <>
            <Select value={action} onValueChange={(v) => setParams({ action: String(v) })}>
              <SelectTrigger aria-label="Filter by action" className="w-52 bg-card">
                <SelectValue>{action === 'all' ? 'All actions' : auditFilterLabel(action)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {['all', ...AUDIT_ACTION_FILTERS].map((key) => (
                  <SelectItem key={key} value={key}>
                    {key === 'all' ? 'All actions' : auditFilterLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RefreshButton onClick={logs.reload} busy={logs.refreshing} />
          </>
        }
      />

      {logs.error ? (
        <LoadError what="the audit log" message={logs.error} onRetry={logs.reload} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {logs.loading || !logs.data ? (
            <Rows n={10} />
          ) : rows.length === 0 ? (
            <Empty title={action === 'all' ? 'Nothing recorded yet' : `No ${auditFilterLabel(action).toLowerCase()} recorded`}>
              {action === 'all' ? 'Changes made from this console will show up here.' : 'Pick another action, or show all actions.'}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Affected</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                  <TableHead className="hidden md:table-cell">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const target = formatAuditUser(row);
                  const summary = formatAuditDetailsSummary(row);
                  return (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="num text-muted-foreground" title={dateTime(row.createdAt)}>
                        {shortTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Tag tone={auditActionTone(row.action)}>{auditActionLabel(row)}</Tag>
                        <span className="mt-1 block max-w-[18rem] text-[13px] whitespace-normal text-muted-foreground lg:hidden">{summary}</span>
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        {target.href ? (
                          <Link href={target.href} className="block truncate font-medium hover:underline">
                            {target.primary}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{target.primary}</span>
                        )}
                        {target.secondary ? <span className="block truncate text-xs text-muted-foreground">{target.secondary}</span> : null}
                      </TableCell>
                      <TableCell className="hidden max-w-sm whitespace-normal text-muted-foreground lg:table-cell">{summary}</TableCell>
                      <TableCell className="hidden max-w-[12rem] truncate text-muted-foreground md:table-cell" title={row.ipAddress ? `From ${row.ipAddress}` : undefined}>
                        {row.admin.name || row.admin.email}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {logs.data ? (
            <Pager
              page={page}
              pages={logs.data.pagination.pages}
              total={logs.data.pagination.total}
              limit={LIMIT}
              noun="entries"
              onPage={(p) => setParams({ page: p })}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<Rows n={10} />}>
      <AuditContent />
    </Suspense>
  );
}
