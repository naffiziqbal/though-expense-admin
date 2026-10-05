'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fetchBillingDrift, fetchBillingEvents, reconcileStalePremium } from '@/lib/api';
import type { BillingDriftUser, BillingWebhookEventRow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function BillingOpsPage() {
  const [drift, setDrift] = useState<BillingDriftUser[] | null>(null);
  const [events, setEvents] = useState<BillingWebhookEventRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadedEventsPage, setLoadedEventsPage] = useState(0);
  const loadingEvents = loadedEventsPage !== page;
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingDrift().then((d) => setDrift(d.items));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBillingEvents(page).then((data) => {
      if (cancelled) return;
      setEvents(data.items);
      setPages(data.pagination.pages);
      setLoadedEventsPage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing ops</h1>
        <p className="text-sm text-muted-foreground">
          RevenueCat webhook history and users whose DB subscription fields look inconsistent.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Stale premium flags</CardTitle>
            <CardDescription>
              Clears <code className="rounded bg-muted px-1">isPremium</code> when{' '}
              <code className="rounded bg-muted px-1">premiumUntil</code> is past or status is expired (missed
              EXPIRATION webhooks). Does not call RevenueCat.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={reconciling}
            onClick={async () => {
              setReconciling(true);
              setReconcileMsg(null);
              try {
                const { updated } = await reconcileStalePremium();
                setReconcileMsg(updated ? `Cleared premium on ${updated} user(s).` : 'No stale flags to clear.');
                fetchBillingDrift().then((d) => setDrift(d.items));
              } catch {
                setReconcileMsg('Reconcile failed.');
              } finally {
                setReconciling(false);
              }
            }}
          >
            {reconciling ? 'Running…' : 'Reconcile stale'}
          </Button>
        </CardHeader>
        {reconcileMsg ? (
          <CardContent className="pt-0 text-sm text-muted-foreground">{reconcileMsg}</CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync drift</CardTitle>
          <CardDescription>Review before changing premium manually — may self-heal on next webhook or status fetch.</CardDescription>
        </CardHeader>
        <CardContent>
          {drift === null ? (
            <Skeleton className="h-24 w-full" />
          ) : drift.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drift detected.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drift.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.name || '—'}</div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">{u.reason}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.isPremium ? <Badge>Premium</Badge> : <Badge variant="secondary">Free</Badge>}
                          {u.subscriptionStatus ? (
                            <Badge variant="outline">{u.subscriptionStatus}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/users/${u.id}`} className="text-sm text-primary hover:underline">
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook events</CardTitle>
          <CardDescription>New events appear after RevenueCat deliveries (not retroactive).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingEvents ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Product</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.createdAt), 'MMM d HH:mm:ss')}
                      </TableCell>
                      <TableCell>{e.eventType}</TableCell>
                      <TableCell>
                        <Badge variant={e.outcome === 'processed' ? 'default' : 'secondary'}>{e.outcome}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.user?.email ?? e.appUserId?.slice(0, 8) ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.productId ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}
