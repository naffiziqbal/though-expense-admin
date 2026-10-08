'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { addMonths, addDays, format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { fetchUser, moderateUser, patchUser, revokeUserSessions } from '@/lib/api';
import type {
  AccountModerationStatus,
  PremiumAccess,
  UserDetail,
  UserRevenueCatLookup,
} from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAiCost } from '@/components/user-ai-cost';
import { cn } from '@/lib/utils';

function initials(name: string | null, email: string): string {
  const base = name?.trim() || email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy, h:mm a');
}

function dateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** End of the chosen calendar day in local time, sent to the API as ISO. */
function premiumUntilFromDateInput(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return end.toISOString();
}

function PlanBadge({ access, isPremium }: { access?: PremiumAccess; isPremium: boolean }) {
  if (!isPremium) return <Badge variant="secondary">Free</Badge>;
  if (access === 'manual') return <Badge className="bg-violet-600 hover:bg-violet-600">Manual premium</Badge>;
  if (access === 'store') return <Badge>Store premium</Badge>;
  return <Badge>Premium</Badge>;
}

function ModerationBadge({ status }: { status?: AccountModerationStatus }) {
  if (status === 'banned') return <Badge variant="destructive">Banned</Badge>;
  if (status === 'suspended') return <Badge variant="outline">Suspended</Badge>;
  return null;
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4 sm:py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm', mono && 'font-mono text-xs')}>{children}</dd>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y px-4 sm:px-5">{children}</div>
    </section>
  );
}

function RcBlock({ rc, manual }: { rc?: UserRevenueCatLookup; manual: boolean }) {
  if (!rc) return <p className="py-3 text-sm text-muted-foreground">No lookup data.</p>;
  if (!rc.configured) {
    return (
      <div className="space-y-2 py-3 text-sm">
        <p className="text-muted-foreground">{rc.message}</p>
        <Link href="/dashboard/operations" className="font-medium text-primary underline-offset-4 hover:underline">
          Operations → RevenueCat
        </Link>
      </div>
    );
  }
  const ok = rc.inSync || (manual && !rc.rcPremium);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 py-3">
        {ok ? (
          <Badge variant="secondary">Aligned</Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/60 text-amber-800 dark:text-amber-200">
            Mismatch
          </Badge>
        )}
        {!ok && rc.reason ? <span className="text-sm text-muted-foreground">{rc.reason}</span> : null}
      </div>
      <Field label="Entitlement">{rc.entitlementId}</Field>
      <Field label="DB premium">{rc.dbPremium ? 'Yes' : 'No'}</Field>
      <Field label="RC active">{rc.rcPremium ? 'Yes' : 'No'}</Field>
      <Field label="Subscriber">{rc.subscriberFound ? 'Yes' : 'No'}</Field>
      <Field label="Product" mono>
        {rc.productId || '—'}
      </Field>
      <Field label="Expires">{rc.expiresDate ? fmt(rc.expiresDate) : '—'}</Field>
    </>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const [user, setUser] = useState<UserDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const loading = !!id && loadedKey !== `${id}:${refreshKey}`;
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantEndDate, setGrantEndDate] = useState('');
  const [grantLifetime, setGrantLifetime] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [modAction, setModAction] = useState<'suspend' | 'ban'>('suspend');
  const [modNote, setModNote] = useState('');
  const [modSaving, setModSaving] = useState(false);

  function openGrantModal() {
    setGrantLifetime(false);
    setGrantEndDate(dateInputValue(addMonths(new Date(), 12)));
    setGrantOpen(true);
  }

  function openModModal(action: 'suspend' | 'ban') {
    setModAction(action);
    setModNote('');
    setModOpen(true);
  }

  async function submitModeration(action: 'suspend' | 'ban' | 'reactivate') {
    if (!user) return;
    setModSaving(true);
    try {
      const u = await moderateUser(user.id, action, modNote.trim() || undefined);
      setUser(u);
      setModOpen(false);
      toast.success(
        action === 'reactivate' ? 'Account reactivated' : action === 'ban' ? 'Account banned' : 'Account suspended'
      );
    } catch {
      toast.error('Could not update account status');
    } finally {
      setModSaving(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const key = `${id}:${refreshKey}`;
    fetchUser(id)
      .then((d) => {
        if (cancelled) return;
        setNotFound(false);
        setUser(d);
        setLoadedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setNotFound(true);
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const minGrantDate = dateInputValue(new Date());

  async function submitGrantPremium() {
    if (!user) return;
    if (!grantLifetime && !grantEndDate) {
      toast.error('Choose an end date or enable lifetime access');
      return;
    }
    setSaving(true);
    try {
      const { user: u, premiumEmailSent } = await patchUser(user.id, {
        isPremium: true,
        premiumUntil: grantLifetime ? null : premiumUntilFromDateInput(grantEndDate),
      });
      setUser(u);
      setGrantOpen(false);
      const base = grantLifetime ? 'Lifetime premium granted' : 'Premium granted until end date';
      if (premiumEmailSent === false) {
        toast.warning(`${base} — could not send email (check Resend on the API server)`);
      } else if (premiumEmailSent === true) {
        toast.success(`${base} — user notified by email`);
      } else {
        toast.success(base);
      }
    } catch {
      toast.error('Could not grant premium');
    } finally {
      setSaving(false);
    }
  }

  async function revokePremium() {
    if (!user) return;
    setSaving(true);
    try {
      const { user: u } = await patchUser(user.id, { isPremium: false });
      setUser(u);
      toast.success('Premium revoked');
    } catch {
      toast.error('Could not revoke premium');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-[480px] w-full rounded-lg" />;

  if (notFound || !user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-lg font-medium">User not found</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/users" />}>
          Back to users
        </Button>
      </div>
    );
  }

  const drift =
    user.subscriptionDrift &&
    !(user.premiumAccess === 'manual' && user.revenueCat?.configured && !user.revenueCat.rcPremium);

  const access =
    user.premiumAccess === 'store'
      ? 'Store (Play / App Store)'
      : user.premiumAccess === 'manual'
        ? 'Manual comp'
        : 'Free';

  return (
    <div className="space-y-6 font-sans">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/dashboard/users" className="hover:text-foreground">
          Users
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{user.email}</span>
      </nav>

      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <Avatar className="size-14 text-base">
            <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{user.name?.trim() || 'Unnamed user'}</h1>
              <ModerationBadge status={user.accountStatus} />
              <PlanBadge access={user.premiumAccess} isPremium={user.isPremium} />
            </div>
            {user.moderationNote ? (
              <p className="text-xs text-muted-foreground">Moderation note: {user.moderationNote}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
              {' · '}
              {user.currency}
              {user.lastActiveAt ?? user.lastExpenseAt
                ? ` · Last activity ${formatDistanceToNow(new Date((user.lastActiveAt ?? user.lastExpenseAt)!), { addSuffix: true })}`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          {user.accountStatus === 'active' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => openModModal('suspend')}>
                Suspend
              </Button>
              <Button variant="destructive" size="sm" onClick={() => openModModal('ban')}>
                Ban
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" disabled={modSaving} onClick={() => submitModeration('reactivate')}>
              Reactivate
            </Button>
          )}
          {user.accountStatus === 'suspended' ? (
            <Button variant="destructive" size="sm" onClick={() => openModModal('ban')}>
              Ban permanently
            </Button>
          ) : null}
          {user.isPremium ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={revokePremium}>
              Revoke premium
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={openGrantModal}>
              Grant premium
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={revoking}
            onClick={async () => {
              setRevoking(true);
              try {
                await revokeUserSessions(user.id);
                toast.success('Sessions revoked');
                reload();
              } catch {
                toast.error('Revoke failed');
              } finally {
                setRevoking(false);
              }
            }}
          >
            {revoking ? 'Revoking…' : 'Revoke sessions'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(user.id);
              toast.success('Copied user id');
            }}
          >
            <Copy className="size-3.5" />
            ID
          </Button>
        </div>
      </div>

      {drift ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/[0.07] px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>{user.subscriptionDrift}</p>
        </div>
      ) : null}

      <Dialog open={modOpen} onOpenChange={setModOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modAction === 'ban' ? 'Ban account permanently' : 'Suspend account'}</DialogTitle>
            <DialogDescription>
              {modAction === 'ban'
                ? 'User cannot sign in or use the API until you reactivate them. All sessions are revoked.'
                : 'User cannot sign in until you reactivate them. All sessions are revoked.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="mod-note">Internal note (optional)</Label>
            <Input
              id="mod-note"
              placeholder="Reason for audit log…"
              value={modNote}
              onChange={(e) => setModNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={modAction === 'ban' ? 'destructive' : 'default'}
              disabled={modSaving}
              onClick={() => submitModeration(modAction)}
            >
              {modSaving ? 'Saving…' : modAction === 'ban' ? 'Ban account' : 'Suspend account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant manual premium</DialogTitle>
            <DialogDescription>
              Sets premium in the database only (not RevenueCat). Choose how long this user should have access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={grantLifetime}
                onClick={() => setGrantEndDate(dateInputValue(addDays(new Date(), 30)))}
              >
                30 days
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={grantLifetime}
                onClick={() => setGrantEndDate(dateInputValue(addMonths(new Date(), 12)))}
              >
                1 year
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium-until">Valid through (end of day)</Label>
              <Input
                id="premium-until"
                type="date"
                min={minGrantDate}
                value={grantEndDate}
                disabled={grantLifetime}
                onChange={(e) => setGrantEndDate(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={grantLifetime}
                onChange={(e) => setGrantLifetime(e.target.checked)}
              />
              <span>
                <span className="font-medium">No end date</span>
                <span className="block text-xs text-muted-foreground">
                  Lifetime manual comp — remember to revoke manually when needed.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={submitGrantPremium}>
              {saving ? 'Saving…' : 'Grant premium'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="billing">
        <TabsList variant="line" className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="billing" className="rounded-none px-4 data-active:after:opacity-100">
            Billing
          </TabsTrigger>
          <TabsTrigger value="usage" className="rounded-none px-4">
            Usage
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-none px-4">
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none px-4">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="mt-6 space-y-4">
          {user.subscription?.summaryLine ? (
            <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm">{user.subscription.summaryLine}</p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="App database" description="Fields that drive premium in the API">
              <Field label="Access">{access}</Field>
              <Field label="Status">{user.subscriptionStatus || '—'}</Field>
              <Field label="Product" mono>
                {user.subscriptionProductId || '—'}
              </Field>
              <Field label="Store">{user.subscriptionStore || '—'}</Field>
              <Field label="Premium since">{fmt(user.premiumSince)}</Field>
              <Field label="Premium until">{fmt(user.premiumUntil)}</Field>
            </Panel>
            <Panel title="RevenueCat" description="Secret key must be set on the API server">
              <RcBlock rc={user.revenueCat} manual={user.premiumAccess === 'manual'} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="mt-6 space-y-4">
          <Panel title="Product usage" description="Aggregate counts only — expense line items are not shown in admin">
            <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3">
              {(
                [
                  ['Expenses', user._count.expenses],
                  ['Insights', user._count.insights],
                  ['Goals', user._count.goals],
                  ['Budgets', user._count.budgets],
                  ['Devices', user._count.deviceTokens],
                  ['Recurring', user._count.recurringRules],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{n.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <Field label="Last active">
              {user.lastActiveAt ? fmt(user.lastActiveAt) : 'Not recorded yet'}
            </Field>
            <Field label="Last expense">{user.lastExpenseAt ? fmt(user.lastExpenseAt) : 'Never'}</Field>
          </Panel>

          <UserAiCost userId={user.id} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <Panel title="Webhook history" description="RevenueCat events for this user">
            {!user.billingEvents?.length ? (
              <p className="py-4 text-sm text-muted-foreground">No events on file.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
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
                        <TableCell className="font-mono text-xs">{ev.productId || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Panel title="Account">
            <Field label="Push">{user.pushEnabled ? 'Enabled' : 'Disabled'}</Field>
            <Field label="Budget alerts">{user.budgetAlertsEnabled ? 'Enabled' : 'Disabled'}</Field>
            <Field label="Created">{fmt(user.createdAt)}</Field>
            <Field label="Updated">{fmt(user.updatedAt)}</Field>
            {user.tokenVersion != null ? <Field label="Token version">{user.tokenVersion}</Field> : null}
            <Field label="Account status">{user.accountStatus ?? 'active'}</Field>
            <Field label="Suspended at">{user.suspendedAt ? fmt(user.suspendedAt) : '—'}</Field>
            <Field label="Banned at">{user.bannedAt ? fmt(user.bannedAt) : '—'}</Field>
            <Field label="User id" mono>
              {user.id}
            </Field>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
