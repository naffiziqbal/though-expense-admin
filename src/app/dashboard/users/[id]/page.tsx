'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { addDays, addMonths, format } from 'date-fns';
import { toast } from 'sonner';
import { ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { fetchUser, moderateUser, patchUser, revokeUserSessions } from '@/lib/api';
import { ago, count, dateTime } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { UserDetail, UserRevenueCatLookup } from '@/lib/types';
import {
  Confirm,
  Empty,
  Field,
  Fields,
  Figure,
  FigureStrip,
  LoadError,
  Notice,
  PageHeader,
  Section,
  Tag,
} from '@/components/console';
import { AccessTag, AccountStatusTag } from '@/components/user-tags';
import { UserAiCost } from '@/components/user-ai-cost';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Moderation = 'suspend' | 'ban' | 'reactivate';

function dateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** End of the chosen calendar day in local time, sent to the API as ISO. */
function endOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

const MODERATION_COPY: Record<Moderation, { title: string; description: string; confirm: string; done: string }> = {
  suspend: {
    title: 'Suspend this account?',
    description: 'They are signed out everywhere and cannot sign in until you reactivate the account. Their data is kept.',
    confirm: 'Suspend account',
    done: 'Account suspended',
  },
  ban: {
    title: 'Ban this account?',
    description:
      'They are signed out everywhere and blocked from signing in or using the API. Use this for abuse. You can reactivate later.',
    confirm: 'Ban account',
    done: 'Account banned',
  },
  reactivate: {
    title: 'Reactivate this account?',
    description: 'They can sign in and use the app again straight away.',
    confirm: 'Reactivate account',
    done: 'Account reactivated',
  },
};

function RevenueCatPanel({ rc, manual }: { rc?: UserRevenueCatLookup; manual: boolean }) {
  if (!rc) return <p className="text-sm text-muted-foreground">No RevenueCat data for this user.</p>;
  if (!rc.configured) {
    return (
      <p className="text-sm text-muted-foreground">
        {rc.message} Set <code className="text-[12px]">REVENUECAT_SECRET_API_KEY</code> on the API to compare.
      </p>
    );
  }
  const aligned = rc.inSync || (manual && !rc.rcPremium);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {aligned ? <Tag tone="ok" dot>Matches the database</Tag> : <Tag tone="warn" dot>Doesn&apos;t match the database</Tag>}
        {!aligned && rc.reason ? <span className="text-sm text-muted-foreground">{rc.reason}</span> : null}
      </div>
      <Fields>
        <Field label="Entitlement" mono>{rc.entitlementId}</Field>
        <Field label="Active in RevenueCat">{rc.rcPremium ? 'Yes' : 'No'}</Field>
        <Field label="Premium in database">{rc.dbPremium ? 'Yes' : 'No'}</Field>
        <Field label="Subscriber found">{rc.subscriberFound ? 'Yes' : 'No'}</Field>
        <Field label="Product" mono>{rc.productId || '–'}</Field>
        <Field label="Expires">{dateTime(rc.expiresDate)}</Field>
      </Fields>
    </>
  );
}

function GrantDialog({ open, onOpenChange, user, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; user: UserDetail; onDone: (u: UserDetail) => void }) {
  const [endDate, setEndDate] = useState(() => dateInputValue(addMonths(new Date(), 12)));
  const [lifetime, setLifetime] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!lifetime && !endDate) {
      toast.error('Choose an end date, or give lifetime access.');
      return;
    }
    setSaving(true);
    try {
      const { user: u, premiumEmailSent } = await patchUser(user.id, {
        isPremium: true,
        premiumUntil: lifetime ? null : endOfDayIso(endDate),
      });
      onDone(u);
      onOpenChange(false);
      const what = lifetime ? 'Lifetime premium granted' : `Premium granted until ${format(new Date(endDate), 'MMM d, yyyy')}`;
      if (premiumEmailSent === false) toast.warning(`${what}. The email to the user failed; check Resend on the API.`);
      else if (premiumEmailSent === true) toast.success(`${what}. The user was emailed.`);
      else toast.success(what);
    } catch {
      toast.error('Could not grant premium. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const presets: [string, Date][] = [
    ['30 days', addDays(new Date(), 30)],
    ['3 months', addMonths(new Date(), 3)],
    ['1 year', addMonths(new Date(), 12)],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant premium to {user.email}</DialogTitle>
          <DialogDescription>
            Premium is set in our database only. Nothing changes in RevenueCat or the store, and the user isn&apos;t charged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="premium-until">Premium until (end of day)</Label>
            <Input
              id="premium-until"
              type="date"
              min={dateInputValue(new Date())}
              value={endDate}
              disabled={lifetime}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presets.map(([label, d]) => (
                <Button key={label} type="button" variant="outline" size="xs" disabled={lifetime} onClick={() => setEndDate(dateInputValue(d))}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} />
            <span>
              <span className="font-medium">No end date</span>
              <span className="block text-muted-foreground">Lifetime access. It stays until someone revokes it here.</span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Granting…' : 'Grant premium'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserBody({ initial, reload, refreshing }: { initial: UserDetail; reload: () => void; refreshing: boolean }) {
  const [user, setUser] = useState(initial);
  const [source, setSource] = useState(initial);
  const [grantOpen, setGrantOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'revoke-premium' | 'revoke-sessions' | Moderation>(null);
  const [modNote, setModNote] = useState('');
  const [aiKey, setAiKey] = useState(0);

  // A reload delivers a new object: show it.
  if (initial !== source) {
    setSource(initial);
    setUser(initial);
  }

  const status = user.accountStatus ?? 'active';
  const manual = user.premiumAccess === 'manual';
  const drift = user.subscriptionDrift && !(manual && user.revenueCat?.configured && !user.revenueCat.rcPremium);
  const lastActive = user.lastActiveAt ?? user.lastExpenseAt;

  async function moderate(action: Moderation) {
    try {
      const u = await moderateUser(user.id, action, modNote.trim() || undefined);
      setUser(u);
      toast.success(MODERATION_COPY[action].done);
      return true;
    } catch {
      toast.error('Could not change the account status. Try again.');
      return false;
    }
  }

  const modAction = confirm === 'suspend' || confirm === 'ban' || confirm === 'reactivate' ? confirm : null;

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/users', label: 'Users' }}
        title={user.name?.trim() || user.email}
        actions={
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Reload this user" onClick={() => { reload(); setAiKey((k) => k + 1); }} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
            </Button>
            {user.isPremium ? (
              <Button variant="outline" onClick={() => setConfirm('revoke-premium')}>
                Revoke premium
              </Button>
            ) : (
              <Button onClick={() => setGrantOpen(true)}>Grant premium</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                Account
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setConfirm('revoke-sessions')}>Sign out of all devices</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void navigator.clipboard.writeText(user.id).then(
                      () => toast.success('User ID copied'),
                      () => toast.error('Could not copy')
                    );
                  }}
                >
                  <Copy />
                  Copy user ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {status === 'active' ? (
                  <>
                    <DropdownMenuItem onClick={() => { setModNote(''); setConfirm('suspend'); }}>Suspend account</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => { setModNote(''); setConfirm('ban'); }}>
                      Ban account
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => { setModNote(''); setConfirm('reactivate'); }}>Reactivate account</DropdownMenuItem>
                    {status === 'suspended' ? (
                      <DropdownMenuItem variant="destructive" onClick={() => { setModNote(''); setConfirm('ban'); }}>
                        Ban account
                      </DropdownMenuItem>
                    ) : null}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <AccountStatusTag status={user.accountStatus} />
          <AccessTag isPremium={user.isPremium} access={user.premiumAccess} />
          {user.name ? <span>{user.email}</span> : null}
          <span>Joined {ago(user.createdAt)}</span>
          <span>{user.currency}</span>
        </div>
      </PageHeader>

      <div className="space-y-8">
        {status !== 'active' ? (
          <Notice
            tone="critical"
            title={status === 'banned' ? `Banned ${ago(user.bannedAt)}` : `Suspended ${ago(user.suspendedAt)}`}
          >
            {user.moderationNote ? `Note: ${user.moderationNote}` : 'No note was left.'}
          </Notice>
        ) : null}
        {drift ? <Notice title="Subscription data looks inconsistent">{user.subscriptionDrift}</Notice> : null}

        <FigureStrip>
          <Figure label="Expenses logged" value={count(user._count.expenses)} />
          <Figure label="Last active" value={lastActive ? ago(lastActive).replace(' ago', '') : 'Never'} note={lastActive ? 'ago' : undefined} />
          <Figure
            label="Premium until"
            value={user.isPremium ? (user.premiumUntil ? format(new Date(user.premiumUntil), 'MMM d') : 'No end') : '–'}
            note={user.isPremium && user.premiumUntil ? format(new Date(user.premiumUntil), 'yyyy') : undefined}
          />
          <Figure label="Devices" value={count(user._count.deviceTokens)} note={user.pushEnabled ? 'Push on' : 'Push off'} />
        </FigureStrip>

        <Tabs defaultValue="billing">
          <TabsList variant="line" className="h-10 w-full justify-start gap-4 border-b p-0">
            <TabsTrigger value="billing" className="flex-none px-0">Billing</TabsTrigger>
            <TabsTrigger value="usage" className="flex-none px-0">Usage and AI cost</TabsTrigger>
            <TabsTrigger value="webhooks" className="flex-none px-0">
              Webhooks
              {user.billingEvents?.length ? <span className="num text-xs text-muted-foreground">{user.billingEvents.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="account" className="flex-none px-0">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="mt-6 space-y-8">
            {user.subscription?.summaryLine ? <p className="max-w-[72ch] text-[15px]">{user.subscription.summaryLine}</p> : null}
            <div className="grid gap-8 lg:grid-cols-2">
              <Section title="In our database" description="These fields decide whether the app unlocks premium.">
                <Fields>
                  <Field label="Access">{user.premiumAccess === 'store' ? 'Store subscription' : manual ? 'Manual premium' : 'Free'}</Field>
                  <Field label="Status">{user.subscriptionStatus || '–'}</Field>
                  <Field label="Product" mono>{user.subscriptionProductId || '–'}</Field>
                  <Field label="Store">{user.subscriptionStore || '–'}</Field>
                  <Field label="Premium since">{dateTime(user.premiumSince)}</Field>
                  <Field label="Premium until">{user.isPremium && !user.premiumUntil ? 'No end date' : dateTime(user.premiumUntil)}</Field>
                </Fields>
              </Section>
              <Section title="In RevenueCat" description="Looked up live when this page loaded.">
                <RevenueCatPanel rc={user.revenueCat} manual={manual} />
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="mt-6 space-y-8">
            <Section title="Product usage" description="Counts only. Expense details are never shown in the console.">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {(
                  [
                    ['Expenses', user._count.expenses],
                    ['Insights', user._count.insights],
                    ['Goals', user._count.goals],
                    ['Budgets', user._count.budgets],
                    ['Recurring rules', user._count.recurringRules],
                    ['Devices', user._count.deviceTokens],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label}>
                    <p className="text-[13px] text-muted-foreground">{label}</p>
                    <p className="figure mt-1 text-[26px]">{count(n)}</p>
                  </div>
                ))}
              </div>
              <Fields className="mt-5 border-t pt-4">
                <Field label="Last active">{user.lastActiveAt ? dateTime(user.lastActiveAt) : 'Not recorded yet'}</Field>
                <Field label="Last expense">{user.lastExpenseAt ? dateTime(user.lastExpenseAt) : 'Never'}</Field>
              </Fields>
            </Section>
            <UserAiCost userId={user.id} refreshKey={aiKey} />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <Section title="RevenueCat webhooks" description="Every subscription event we received for this user, newest first." flush>
              {!user.billingEvents?.length ? (
                <Empty title="No webhooks yet">They appear once this user starts, renews or cancels a store subscription.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Product</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.billingEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-muted-foreground">{dateTime(ev.createdAt)}</TableCell>
                        <TableCell className="font-medium">{ev.eventType}</TableCell>
                        <TableCell>
                          <Tag tone={ev.outcome === 'processed' ? 'ok' : 'neutral'}>{ev.outcome}</Tag>
                        </TableCell>
                        <TableCell className="font-mono text-[13px]">{ev.productId || '–'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <Section title="Account">
              <Fields>
                <Field label="Status">{status === 'active' ? 'Active' : status === 'banned' ? 'Banned' : 'Suspended'}</Field>
                {user.suspendedAt ? <Field label="Suspended">{dateTime(user.suspendedAt)}</Field> : null}
                {user.bannedAt ? <Field label="Banned">{dateTime(user.bannedAt)}</Field> : null}
                <Field label="Push notifications">{user.pushEnabled ? 'On' : 'Off'}</Field>
                <Field label="Budget alerts">{user.budgetAlertsEnabled ? 'On' : 'Off'}</Field>
                <Field label="Created">{dateTime(user.createdAt)}</Field>
                <Field label="Last updated">{dateTime(user.updatedAt)}</Field>
                {user.tokenVersion != null ? <Field label="Session version">{user.tokenVersion}</Field> : null}
                <Field label="User ID" mono>{user.id}</Field>
              </Fields>
            </Section>
          </TabsContent>
        </Tabs>
      </div>

      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} user={user} onDone={setUser} />

      <Confirm
        open={confirm === 'revoke-premium'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Revoke premium?"
        description={
          user.premiumAccess === 'store'
            ? 'This user pays through the store. Revoking here removes access now, but their store subscription keeps billing, and the next RevenueCat webhook may turn premium back on.'
            : 'They lose premium features straight away. Their data stays.'
        }
        confirmLabel="Revoke premium"
        busyLabel="Revoking…"
        destructive
        onConfirm={async () => {
          try {
            const { user: u } = await patchUser(user.id, { isPremium: false });
            setUser(u);
            toast.success('Premium revoked');
            return true;
          } catch {
            toast.error('Could not revoke premium. Try again.');
            return false;
          }
        }}
      />

      <Confirm
        open={confirm === 'revoke-sessions'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Sign this user out of all devices?"
        description="Every session ends now. They can sign in again with their password."
        confirmLabel="Sign out everywhere"
        busyLabel="Signing out…"
        onConfirm={async () => {
          try {
            await revokeUserSessions(user.id);
            toast.success('Signed out of all devices');
            reload();
            return true;
          } catch {
            toast.error('Could not sign them out. Try again.');
            return false;
          }
        }}
      />

      {modAction ? (
        <Confirm
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={MODERATION_COPY[modAction].title}
          description={MODERATION_COPY[modAction].description}
          confirmLabel={MODERATION_COPY[modAction].confirm}
          destructive={modAction !== 'reactivate'}
          onConfirm={() => moderate(modAction)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="mod-note">Note for the audit log (optional)</Label>
            <Input id="mod-note" placeholder="Why you're doing this" value={modNote} onChange={(e) => setModNote(e.target.value)} />
          </div>
        </Confirm>
      ) : null}
    </>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  const user = useLoad(() => fetchUser(id), id);

  if (user.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-[104px] w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (user.error || !user.data) {
    const notFound = user.error?.includes('404') || /not found/i.test(user.error ?? '');
    return (
      <>
        <PageHeader back={{ href: '/dashboard/users', label: 'Users' }} title={notFound ? 'User not found' : 'Couldn’t load this user'} />
        {notFound ? (
          <p className="text-sm text-muted-foreground">
            No account has the ID <code className="text-[13px]">{id}</code>. It may have been deleted.{' '}
            <Link href="/dashboard/users" className="text-primary hover:underline">Search users</Link>
          </p>
        ) : (
          <LoadError what="this user" message={user.error ?? ''} onRetry={user.reload} />
        )}
      </>
    );
  }
  return <UserBody initial={user.data} reload={user.reload} refreshing={user.refreshing} />;
}
