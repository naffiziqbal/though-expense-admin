'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { fetchBillingDrift, fetchBillingEvents, reconcileStalePremium } from '@/lib/api';
import { useAttention } from '@/lib/attention';
import { count, dateTime } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import {
  Confirm,
  Empty,
  LoadError,
  PageHeader,
  Pager,
  RefreshButton,
  Rows,
  Section,
  Tag,
} from '@/components/console';
import { AccessTag } from '@/components/user-tags';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const EVENTS_LIMIT = 30;

function StalePremium({ onCleared }: { onCleared: () => void }) {
  const overview = useAttention((s) => s.overview);
  const refreshAttention = useAttention((s) => s.refresh);
  const [confirm, setConfirm] = useState(false);
  const b = overview?.premiumBreakdown;
  const stale = b ? b.stalePeriodEnd + b.statusExpired : null;

  return (
    <Section
      title="Premium that should have ended"
      description="Users who still have premium although their period end has passed or their status is expired. This usually means a missed EXPIRATION webhook."
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className={stale ? 'figure text-[44px] text-warn' : 'figure text-[44px]'}>{stale == null ? '–' : count(stale)}</span>
          <span className="text-sm text-muted-foreground">
            {b ? (
              <>
                {count(b.stalePeriodEnd)} past their end date, {count(b.statusExpired)} marked expired
              </>
            ) : (
              'Counting…'
            )}
          </span>
        </div>
        <Button variant={stale ? 'default' : 'outline'} disabled={!stale} onClick={() => setConfirm(true)}>
          Clear stale premium
        </Button>
      </div>

      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove premium from ${stale ?? 0} users?`}
        description="Premium is turned off for every user whose period has ended or whose status is expired. RevenueCat isn't called. If someone actually renewed, their next webhook turns premium back on. The change is recorded in the audit log."
        confirmLabel="Clear stale premium"
        busyLabel="Clearing…"
        destructive
        onConfirm={async () => {
          try {
            const { updated } = await reconcileStalePremium();
            toast.success(updated ? `Premium cleared on ${count(updated)} users` : 'Nothing to clear. Every premium user is in period.');
            void refreshAttention();
            onCleared();
            return true;
          } catch {
            toast.error('Clearing failed. Nothing was changed. Try again.');
            return false;
          }
        }}
      />
    </Section>
  );
}

function Drift({ reloadKey }: { reloadKey: number }) {
  const drift = useLoad(fetchBillingDrift, String(reloadKey));

  return (
    <Section
      title="Inconsistent subscription data"
      description="The fields on these accounts disagree with each other. Most fix themselves on the next webhook, so check the account before changing premium by hand."
      flush
      actions={<RefreshButton onClick={drift.reload} busy={drift.refreshing} />}
    >
      {drift.loading ? (
        <Rows n={3} />
      ) : drift.error || !drift.data ? (
        <div className="p-5">
          <LoadError what="drift" message={drift.error ?? ''} onRetry={drift.reload} />
        </div>
      ) : drift.data.items.length === 0 ? (
        <Empty title="No inconsistent accounts">Every account&apos;s premium flag, status and dates agree.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>What&apos;s wrong</TableHead>
              <TableHead>Now</TableHead>
              <TableHead className="hidden md:table-cell">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drift.data.items.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="max-w-[16rem]">
                  <Link href={`/dashboard/users/${u.id}`} className="block truncate font-medium hover:underline">
                    {u.email}
                  </Link>
                  {u.name ? <span className="block truncate text-xs text-muted-foreground">{u.name}</span> : null}
                </TableCell>
                <TableCell className="max-w-sm text-sm whitespace-normal">{u.reason}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1.5">
                    <AccessTag isPremium={u.isPremium} />
                    {u.subscriptionStatus ? <Tag>{u.subscriptionStatus}</Tag> : null}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{dateTime(u.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function Webhooks() {
  const [page, setPage] = useState(1);
  const events = useLoad(() => fetchBillingEvents(page), String(page));

  return (
    <Section
      title="RevenueCat webhooks"
      description="Every subscription event RevenueCat sent us, newest first."
      flush
      actions={<RefreshButton onClick={events.reload} busy={events.refreshing} />}
    >
      {events.loading ? (
        <Rows n={8} />
      ) : events.error || !events.data ? (
        <div className="p-5">
          <LoadError what="webhooks" message={events.error ?? ''} onRetry={events.reload} />
        </div>
      ) : events.data.items.length === 0 ? (
        <Empty title="No webhooks received yet">They appear here as RevenueCat delivers them.</Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="hidden lg:table-cell">Product</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{dateTime(e.createdAt)}</TableCell>
                  <TableCell className="font-medium">{e.eventType}</TableCell>
                  <TableCell>
                    <Tag tone={e.outcome === 'processed' ? 'ok' : e.outcome.includes('error') || e.outcome.includes('fail') ? 'critical' : 'neutral'}>
                      {e.outcome}
                    </Tag>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    {e.user ? (
                      <Link href={`/dashboard/users/${e.user.id}`} className="block truncate hover:underline">
                        {e.user.email}
                      </Link>
                    ) : (
                      <span className="font-mono text-[13px] text-muted-foreground" title={e.appUserId ?? undefined}>
                        {e.appUserId ? `${e.appUserId.slice(0, 12)}…` : 'Unknown'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden font-mono text-[13px] text-muted-foreground lg:table-cell">{e.productId ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            page={page}
            pages={events.data.pagination.pages}
            total={events.data.pagination.total}
            limit={EVENTS_LIMIT}
            noun="events"
            onPage={setPage}
          />
        </>
      )}
    </Section>
  );
}

export default function BillingPage() {
  const [driftKey, setDriftKey] = useState(0);
  return (
    <>
      <PageHeader title="Billing" description="Keep premium in our database in step with what the stores and RevenueCat say." />
      <div className="space-y-12">
        <StalePremium onCleared={() => setDriftKey((k) => k + 1)} />
        <Drift reloadKey={driftKey} />
        <Webhooks />
      </div>
    </>
  );
}
