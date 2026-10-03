'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { fetchUser, patchUser, revokeUserSessions } from '@/lib/api';
import type { UserDetail } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetchUser(id).then(setUser).catch(() => toast.error('User not found'));
  }, [id]);

  async function revokeSessions() {
    if (!user) return;
    setRevoking(true);
    try {
      await revokeUserSessions(user.id);
      toast.success('All app sessions revoked — user must sign in again.');
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
      await patchUser(user.id, { isPremium: !user.isPremium });
      setUser({ ...user, isPremium: !user.isPremium });
      toast.success('User updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <Skeleton className="h-96 w-full max-w-2xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Subscription</CardTitle>
          {user.isPremium ? <Badge>Premium</Badge> : <Badge variant="secondary">Free</Badge>}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
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
            <span className="text-muted-foreground">Premium until:</span>{' '}
            {user.premiumUntil ? format(new Date(user.premiumUntil), 'PPpp') : '—'}
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
          <p>Joined: {format(new Date(user.createdAt), 'PPpp')}</p>
          <p>User ID: {user.id}</p>
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
