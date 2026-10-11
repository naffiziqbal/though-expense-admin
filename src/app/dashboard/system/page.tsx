'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Download, Send } from 'lucide-react';
import { createBackupDownloadLink, fetchSystemBackups, fetchSystemHealth, sendTestAlert } from '@/lib/api';
import { BACKUP_STALE_MS, MONITOR_STALE_MS, useAttention } from '@/lib/attention';
import { ago, bytes, count, dateTime, duration, humanize } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { SystemBackups, SystemHealth } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Confirm,
  Dot,
  Empty,
  Field,
  Fields,
  LoadError,
  Notice,
  PageHeader,
  RefreshButton,
  Rows,
  Section,
  Tag,
  type Tone,
} from '@/components/console';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7100';

function Headline({ health }: { health: SystemHealth }) {
  const map: Record<SystemHealth['status'], { tone: Tone; text: string }> = {
    ok: { tone: 'ok', text: 'Everything is running' },
    degraded: { tone: 'warn', text: 'Running with problems' },
    down: { tone: 'critical', text: 'The API is down' },
  };
  const s = map[health.status];
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
      <p className={cn('flex items-center gap-2.5 text-lg font-semibold', s.tone === 'warn' && 'text-warn', s.tone === 'critical' && 'text-critical')}>
        <Dot tone={s.tone} />
        {s.text}
      </p>
      <p className="text-sm text-muted-foreground sm:ml-auto">
        Up {duration(health.uptime)} on {health.nodeEnv}, checked {ago(health.timestamp)}
      </p>
    </div>
  );
}

function ServiceRows({ health }: { health: SystemHealth }) {
  return (
    <Fields>
      <Field label="Database">
        {health.database.ok ? (
          <span className="flex flex-wrap items-center gap-2">
            <Tag tone="ok" dot>Up</Tag>
            <span className="num text-muted-foreground">{health.database.latencyMs} ms</span>
            <span className="text-muted-foreground">{health.database.version}</span>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <Tag tone="critical" dot>Down</Tag>
            <span className="text-critical">{health.database.message}</span>
          </span>
        )}
      </Field>
      <Field label="Redis">
        {health.redis?.ok ? <Tag tone="ok" dot>Up</Tag> : <Tag tone="critical" dot>{health.redis?.message ?? 'Unknown'}</Tag>}
      </Field>
      <Field label="API address" mono>{apiUrl}</Field>
    </Fields>
  );
}

function Migrations({ m }: { m: SystemHealth['migrations'] }) {
  if (!m) return <p className="text-sm text-muted-foreground">Couldn&apos;t read migration status from the database.</p>;
  return (
    <div className="space-y-4">
      <Fields>
        <Field label="Applied">
          <span className="num">
            {count(m.applied)} of {count(m.total)}
          </span>{' '}
          {m.historyMissing ? null : m.failed.length ? (
            <Tag tone="critical">Failed</Tag>
          ) : m.pending.length ? (
            <Tag tone="warn">{m.pending.length} pending</Tag>
          ) : (
            <Tag tone="ok">Up to date</Tag>
          )}
        </Field>
        <Field label="Latest">
          {m.latestApplied ? (
            <>
              <span className="block font-mono text-[13px] break-all">{m.latestApplied.name}</span>
              <span className="text-xs text-muted-foreground">{dateTime(m.latestApplied.appliedAt)}</span>
            </>
          ) : (
            '–'
          )}
        </Field>
      </Fields>
      {m.historyMissing ? (
        <Notice tone="critical" title="This database has no migration history">
          It was probably created with <code>prisma db push</code>, so deploys will fail at <code>migrate deploy</code> until the
          existing migrations are baselined. Don&apos;t run <code>db push</code> or <code>migrate reset</code> on production.
        </Notice>
      ) : null}
      {m.failed.length ? (
        <Notice tone="critical" title="Started but didn't finish">
          {m.failed.map((n) => (
            <span key={n} className="block font-mono text-[13px] break-all">{n}</span>
          ))}
        </Notice>
      ) : null}
      {m.pending.length && !m.historyMissing ? (
        <Notice title="Not applied yet. The running code may expect these.">
          {m.pending.map((n) => (
            <span key={n} className="block font-mono text-[13px] break-all">{n}</span>
          ))}
        </Notice>
      ) : null}
    </div>
  );
}

function Alerts({ alerts, checkedAt }: { alerts: SystemHealth['alerts']; checkedAt: number }) {
  const [sending, setSending] = useState(false);
  if (!alerts) return <p className="text-sm text-muted-foreground">Alert status is unavailable because Redis can&apos;t be reached.</p>;
  const stale = !!alerts.monitorLastRun && checkedAt - new Date(alerts.monitorLastRun.at).getTime() > MONITOR_STALE_MS;

  return (
    <div className="space-y-4">
      <Fields>
        <Field label="Telegram">
          {alerts.telegramConfigured ? (
            <span className="flex items-center gap-2">
              <Tag tone="ok" dot>Connected</Tag>
              <span className="text-muted-foreground">{alerts.envLabel}</span>
            </span>
          ) : (
            <Tag tone="critical" dot>Not set up</Tag>
          )}
        </Field>
        <Field label="Last check">
          {alerts.monitorLastRun ? (
            <span className={cn(stale && 'font-medium text-critical')}>
              {ago(alerts.monitorLastRun.at)}, {alerts.monitorLastRun.checks} checks
            </span>
          ) : (
            'Never'
          )}
        </Field>
      </Fields>
      {stale ? <Notice tone="critical" title="The monitor hasn't run for over 30 minutes">Alerts may not be reaching Telegram.</Notice> : null}
      {!alerts.telegramConfigured ? (
        <p className="text-sm text-muted-foreground">Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALERT_CHAT_ID on the API to get alerts.</p>
      ) : null}
      {alerts.firing.length ? (
        <ul className="divide-y rounded-lg border">
          {alerts.firing.map((a) => (
            <li key={a.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.title}</span>
                <span className="text-xs text-muted-foreground">Firing since {ago(a.since)}</span>
              </span>
              <Tag tone={a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warn' : 'neutral'}>{humanize(a.severity)}</Tag>
            </li>
          ))}
        </ul>
      ) : alerts.telegramConfigured ? (
        <p className="text-sm text-muted-foreground">No alerts firing.</p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={sending || !alerts.telegramConfigured}
        onClick={async () => {
          setSending(true);
          try {
            await sendTestAlert();
            toast.success('Test alert sent. Check Telegram.');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send the test alert');
          } finally {
            setSending(false);
          }
        }}
      >
        <Send />
        {sending ? 'Sending…' : 'Send test alert'}
      </Button>
    </div>
  );
}

function Backups({ backups, checkedAt }: { backups: SystemBackups; checkedAt: number }) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [link, setLink] = useState<{ fileName: string; url: string; expiresAt: string } | null>(null);
  const stale = !!backups.lastSuccessAt && checkedAt - new Date(backups.lastSuccessAt).getTime() > BACKUP_STALE_MS;

  if (!backups.configured) {
    return <Empty title="Backup storage isn't set up">Configure Spaces credentials on the API to list nightly backups here.</Empty>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3 text-sm">
        <span>
          <span className="text-muted-foreground">Last successful backup </span>
          {backups.lastSuccessAt ? (
            <span className={cn('font-medium', stale && 'text-critical')} title={dateTime(backups.lastSuccessAt)}>
              {ago(backups.lastSuccessAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">isn&apos;t visible from the API host</span>
          )}
        </span>
        {backups.lastSuccessAt ? <Tag tone={stale ? 'critical' : 'ok'} dot>{stale ? 'Overdue' : 'On schedule'}</Tag> : null}
        <span className="text-muted-foreground sm:ml-auto">{count(backups.total)} stored</span>
      </div>
      {backups.items.length === 0 ? (
        <Empty title="No backups stored yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead className="hidden sm:table-cell">File</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Download</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.items.map((b) => (
              <TableRow key={b.key}>
                <TableCell>
                  {dateTime(b.createdAt)}
                  <span className="block text-xs text-muted-foreground">{ago(b.createdAt)}</span>
                </TableCell>
                <TableCell className="hidden font-mono text-[13px] text-muted-foreground sm:table-cell">{b.fileName}</TableCell>
                <TableCell className="num text-right">{bytes(b.sizeBytes)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmKey(b.key)} aria-label={`Download ${b.fileName}`}>
                    <Download />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Confirm
        open={!!confirmKey}
        onOpenChange={(o) => !o && setConfirmKey(null)}
        title="Create a download link for this backup?"
        description="The backup is the whole database: every user's email, password hash and expenses. Anyone with the link can download it for one hour. Creating it is recorded in the audit log and announced on Telegram."
        confirmLabel="Create link"
        busyLabel="Creating…"
        destructive
        onConfirm={async () => {
          if (!confirmKey) return;
          try {
            const res = await createBackupDownloadLink(confirmKey);
            setLink({ fileName: confirmKey.split('/').pop() ?? confirmKey, ...res });
            return true;
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not create the download link');
            return false;
          }
        }}
      >
        <p className="font-mono text-[13px] break-all text-muted-foreground">{confirmKey?.split('/').pop()}</p>
      </Confirm>

      <Dialog open={!!link} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download link ready</DialogTitle>
            <DialogDescription>
              It works until {link ? dateTime(link.expiresAt) : ''}. Don&apos;t paste it into chat or tickets.
            </DialogDescription>
          </DialogHeader>
          <p className="font-mono text-[13px] break-all text-muted-foreground">{link?.fileName}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!link) return;
                void navigator.clipboard.writeText(link.url).then(
                  () => toast.success('Link copied'),
                  () => toast.error('Could not copy')
                );
              }}
            >
              <Copy />
              Copy link
            </Button>
            <Button nativeButton={false} render={<a href={link?.url} rel="noreferrer noopener" onClick={() => setLink(null)} />}>
              <Download />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SystemPage() {
  const health = useLoad(fetchSystemHealth);
  const backups = useLoad(fetchSystemBackups);
  const refreshAttention = useAttention((s) => s.refresh);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const busy = health.loading || health.refreshing || backups.loading || backups.refreshing;

  return (
    <>
      <PageHeader
        title="System"
        description="Service health, the deployed version, migrations, alerting and nightly database backups."
        actions={
          <RefreshButton
            busy={busy}
            onClick={() => {
              health.reload();
              backups.reload();
              setCheckedAt(Date.now());
              void refreshAttention();
            }}
          />
        }
      />

      <div className="space-y-12">
        {health.loading ? (
          <Skeleton className="h-[60px] w-full rounded-xl" />
        ) : health.error || !health.data ? (
          <LoadError what="system health" message={`${health.error ?? ''} Is the API running at ${apiUrl}?`} onRetry={health.reload} />
        ) : (
          <Headline health={health.data} />
        )}

        {health.data ? (
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8">
            <Section title="Services">
              <ServiceRows health={health.data} />
            </Section>
            <Section title="Deployed version" description="The code the running API was started from.">
              <Fields>
                <Field label="Commit" mono>{health.data.deploy.commit ?? 'Unknown'}</Field>
                <Field label="Message">{health.data.deploy.commitMessage ?? '–'}</Field>
                <Field label="Committed">{dateTime(health.data.deploy.committedAt)}</Field>
                <Field label="Started">
                  {dateTime(health.data.deploy.startedAt)}
                  <span className="block text-xs text-muted-foreground">{ago(health.data.deploy.startedAt)}</span>
                </Field>
              </Fields>
            </Section>
            <Section title="Database migrations" description="Migrations shipped with this build compared with what the database has applied.">
              <Migrations m={health.data.migrations} />
            </Section>
            <Section title="Alerts" description="Telegram alerts, checked every 15 minutes.">
              <Alerts alerts={health.data.alerts} checkedAt={checkedAt} />
            </Section>
          </div>
        ) : null}

        <Section
          id="backups"
          title="Database backups"
          description="Nightly dumps stored in Spaces. Download links last one hour, go in the audit log and are announced on Telegram."
          flush
        >
          {backups.loading ? (
            <Rows n={4} />
          ) : backups.error || !backups.data ? (
            <div className="p-5">
              <LoadError what="backups" message={backups.error ?? ''} onRetry={backups.reload} />
            </div>
          ) : (
            <Backups backups={backups.data} checkedAt={checkedAt} />
          )}
        </Section>
      </div>
    </>
  );
}
