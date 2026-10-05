'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { fetchUser, patchUser, revokeUserSessions } from '@/lib/api';
import type { UserDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${format(d, 'PPpp')} (${d.toISOString()})`;
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

  if (loading || !user) return <Skeleton className="h-96 w-full max-w-2xl" />;

  const accessLabel =
    user.premiumAccess === 'store'
      ? 'Store subscription (RevenueCat / Play)'
      : user.premiumAccess === 'manual'
        ? 'Manual / comp (no store product on file)'
        : 'Free';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      {user.subscriptionDrift ? (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscription drift</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {user.subscriptionDrift}{' '}
            <Link href="/dashboard/billing" className="text-primary hover:underline">
              Billing ops
            </Link>{' '}
            ·{' '}
            <Link href="/dashboard/operations" className="text-primary hover:underline">
              RevenueCat check
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Refreshed on load — same rules as in-app billing status</CardDescription>
          </div>
          {user.isPremium ? <Badge>Premium</Badge> : <Badge variant="secondary">Free</Badge>}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {user.subscription?.summaryLine ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 font-medium text-foreground">
              {user.subscription.summaryLine}
            </p>
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
          <p className="text-xs text-muted-foreground">
            Times show your browser locale plus UTC ISO. RevenueCat may differ if webhooks were missed.
          </p>
          <Button variant="outline" disabled={saving} onClick={togglePremium} className="mt-4">
            {user.isPremium ? 'Revoke premium (manual)' : 'Grant premium (manual)'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Manual overrides do not sync to RevenueCat. Use for support comp access only.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Live counts from Postgres for this user id</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Expenses" value={user._count.expenses} />
          <Stat label="Insights" value={user._count.insights} />
          <Stat label="Goals" value={user._count.goals} />
          <Stat label="Budgets" value={user._count.budgets} />
          <Stat label="Devices" value={user._count.deviceTokens} />
          <Stat label="Recurring rules" value={user._count.recurringRules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Currency: {user.currency}</p>
          <p>Push enabled: {user.pushEnabled ? 'yes' : 'no'}</p>
          <p>Budget alerts: {user.budgetAlertsEnabled ? 'yes' : 'no'}</p>
          <p>Joined: {formatTs(user.createdAt)}</p>
          <p>Updated: {formatTs(user.updatedAt)}</p>
          <p className="font-mono text-xs text-foreground">User ID: {user.id}</p>
          {user.tokenVersion != null ? (
            <p>Session generation (tokenVersion): {user.tokenVersion}</p>
          ) : null}
          <Button variant="destructive" size="sm" disabled={revoking} onClick={revokeSessions}>
            {revoking ? 'Revoking…' : 'Revoke all sessions'}
          </Button>
          <p className="text-xs">Increments token version — mobile and web must log in again.</p>
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
