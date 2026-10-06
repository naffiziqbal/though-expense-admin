'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fetchAuditLogs } from '@/lib/api';
import {
  auditActionLabel,
  auditActionVariant,
  AUDIT_ACTION_LABELS,
  formatAuditDetailsSummary,
  formatAuditTarget,
  compactJson,
  type AuditActionFilter,
} from '@/lib/audit-format';
import type { AdminAuditLogRow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ACTION_FILTERS: AuditActionFilter[] = [
  'all',
  'user.update',
  'user.revoke_sessions',
  'user.suspend',
  'user.ban',
  'user.reactivate',
  'billing.reconcile_stale_premium',
];

export default function AuditPage() {
  const [items, setItems] = useState<AdminAuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadedPage, setLoadedPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<AuditActionFilter>('all');
  const loading = loadedPage !== page;

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs(page).then((data) => {
      if (cancelled) return;
      setItems(data.items);
      setPages(data.pagination.pages);
      setLoadedPage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    setPage(1);
    setLoadedPage(0);
  }, [actionFilter]);

  const visibleItems = useMemo(() => {
    if (actionFilter === 'all') return items;
    return items.filter((row) => row.action === actionFilter);
  }, [items, actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Premium comp changes, moderation, session revokes, and billing maintenance.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditActionFilter)}>
            <SelectTrigger aria-label="Filter by action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((key) => (
                <SelectItem key={key} value={key}>
                  {key === 'all' ? 'All actions' : auditActionLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Premium changes and session revokes are recorded here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {actionFilter === 'all' ? 'No audit entries yet.' : 'No entries for this action on this page.'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[7.5rem]">Time</TableHead>
                    <TableHead className="min-w-[10rem]">Admin</TableHead>
                    <TableHead className="w-[9rem]">Action</TableHead>
                    <TableHead className="w-[9rem]">Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((row) => {
                    const target = formatAuditTarget(row);
                    const summary = formatAuditDetailsSummary(row);
                    const raw = row.metadata ? compactJson(row.metadata) : null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {format(new Date(row.createdAt), 'MMM d HH:mm')}
                        </TableCell>
                        <TableCell className="text-sm">{row.admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={auditActionVariant(row.action)} className="font-normal">
                            {row.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {target.href ? (
                            <Link
                              href={target.href}
                              className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                            >
                              {target.label}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{target.label}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-foreground">{summary}</p>
                          {raw && raw !== summary ? (
                            <p
                              className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
                              title={raw}
                            >
                              {raw}
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Logged actions:{' '}
            {Object.entries(AUDIT_ACTION_LABELS)
              .map(([k, v]) => `${k} (${v})`)
              .join(' · ')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
