'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { fetchUser, patchUser, revokeUserSessions } from '@/lib/api';
import type { UserDetail, UserRevenueCatLookup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${format(d, 'PPpp')} (${d.toISOString()})`;
}

function RevenueCatCard({ rc, manualPremium }: { rc?: UserRevenueCatLookup; manualPremium: boolean }) {
  if (!rc) return null;
  if (!rc.configured) {
    return <p className="text-sm text-muted-foreground">{rc.message}</p>;
  }
  const expectedManual = manualPremium && !rc.rcPremium;
  return (
    <div className="space-y-2 text-sm">
      <p>
        Entitlement <strong>{rc.entitlementId}</strong> · DB premium:{' '}
        <strong>{rc.dbPremium ? 'yes' : 'no'}</strong> · RC active:{' '}
        <strong>{rc.rcPremium ? 'yes' : 'no'}</strong>
      </p>
      {rc.subscriberFound ? (
        <>
          <p>
            <span className="text-muted-foreground">RC product:</span> {rc.productId || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">RC expires:</span>{' '}
            {rc.expiresDate ? formatTs(rc.expiresDate) : 'lifetime / none'}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No RevenueCat subscriber for this app user id.</p>
      )}
      {rc.inSync || expectedManual ? (
        <Badge variant={expectedManual ? 'secondary' : 'default'}>
          {expectedManual ? 'Manual comp — inactive RC is normal' : 'In sync'}
        </Badge>
      ) : (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-amber-900 dark:text-amber-100">
          {rc.reason}
        </p>
      )}
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setUser(await fetchUser(id));
    } catch {
      toast.error('User not found');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function revokeSessions() {
    if (!user) return;
    setRevoking(true);
    try {
      await revokeUserSessions(user.id);
      toast.success('All app sessions revoked — user must sign in again.');
      await load();
    } catch {
      toast.error('Could not revoke sessions');
    } finally {
      setRevoking(false);
    }
  }

  async function togglePremium() {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await patchUser(user.id, { isPremium: !user.isPremium });
      setUser(updated);
      toast.success('User updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <Skeleton className="h-[600px] w-full max-w-3xl" />;

  const accessLabel =
    user.premiumAccess === 'store'
      ? 'Store subscription (RevenueCat / Play)'
      : user.premiumAccess === 'manual'
        ? 'Manual / comp (no store product on file)'
        : 'Free';

  const showDrift =
    user.subscriptionDrift &&
    !(user.premiumAccess === 'manual' && user.revenueCat?.configured && !user.revenueCat.rcPremium);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        {user.isPremium ? (
          user.premiumAccess === 'manual' ? (
            <Badge className="bg-violet-600 hover:bg-violet-600">Premium · manual</Badge>
          ) : (
            <Badge>Premium</Badge>
          )
        ) : (
          <Badge variant="secondary">Free</Badge>
        )}
      </div>

      {showDrift ? (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscription drift</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{user.subscriptionDrift}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Same refresh rules as in-app billing status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user.subscription?.summaryLine ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 font-medium">{user.subscription.summaryLine}</p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Access source:</span> {accessLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {user.subscriptionStatus || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Product:</span> {user.subscriptionProductId || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Store:</span> {user.subscriptionStore || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Premium since:</span> {formatTs(user.premiumSince)}
            </p>
            <p>
              <span className="text-muted-foreground">Premium until:</span> {formatTs(user.premiumUntil)}
            </p>
            <Button variant="outline" disabled={saving} onClick={togglePremium} className="mt-4">
              {user.isPremium ? 'Revoke premium (manual)' : 'Grant premium (manual)'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Manual grants do not sync to RevenueCat. Your 19 comp users should show as{' '}
              <strong>Premium · manual</strong> in the user list filter.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RevenueCat</CardTitle>
            <CardDescription>Live lookup for this user id</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueCatCard rc={user.revenueCat} manualPremium={user.premiumAccess === 'manual'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Expenses" value={user._count.expenses} />
            <Stat label="Insights" value={user._count.insights} />
            <Stat label="Goals" value={user._count.goals} />
            <Stat label="Budgets" value={user._count.budgets} />
            <Stat label="Devices" value={user._count.deviceTokens} />
            <Stat label="Recurring" value={user._count.recurringRules} />
          </CardContent>
          <CardContent className="border-t pt-4 text-sm text-muted-foreground">
            Last expense: {user.lastExpenseAt ? formatTs(user.lastExpenseAt) : '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
          <CardDescription>Latest 12 by expense date</CardDescription>
        </CardHeader>
        <CardContent>
          {!user.recentExpenses?.length ? (
            <p className="text-sm text-muted-foreground">No expenses logged.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.recentExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(e.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell className="text-right font-medium">
                        {e.amount.toLocaleString()} {e.currency}
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
          <CardTitle>Billing webhooks</CardTitle>
          <CardDescription>RevenueCat events linked to this user</CardDescription>
        </CardHeader>
        <CardContent>
          {!user.billingEvents?.length ? (
            <p className="text-sm text-muted-foreground">
              No webhook events stored for this user (common for manual premium).
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Product</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.billingEvents.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(ev.createdAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>{ev.eventType}</TableCell>
                      <TableCell>{ev.outcome}</TableCell>
                      <TableCell className="text-xs">{ev.productId || '—'}</TableCell>
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
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Currency: {user.currency}</p>
          <p>Push: {user.pushEnabled ? 'on' : 'off'} · Budget alerts: {user.budgetAlertsEnabled ? 'on' : 'off'}</p>
          <p>Joined: {formatTs(user.createdAt)}</p>
          <p className="font-mono text-xs text-foreground">User ID: {user.id}</p>
          {user.tokenVersion != null ? <p>tokenVersion: {user.tokenVersion}</p> : null}
          <Button variant="destructive" size="sm" disabled={revoking} onClick={revokeSessions}>
            {revoking ? 'Revoking…' : 'Revoke all sessions'}
          </Button>
          <p className="text-xs">
            <Link href="/dashboard/users" className="text-primary hover:underline">
              Back to users
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
